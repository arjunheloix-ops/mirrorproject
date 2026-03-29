const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const CHUNKS_DIR = path.join(UPLOADS_DIR, 'chunks');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const id = uuidv4();
    const ext = path.extname(file.originalname) || '.webm';
    req.recordingId = id;
    cb(null, `${id}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// Chunk upload storage — each chunk goes into uploads/chunks/{sessionId}/
const chunkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sessionId = req.body.sessionId || req.query.sessionId;
    if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      return cb(new Error('Invalid sessionId'));
    }
    const sessionDir = path.join(CHUNKS_DIR, sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });
    cb(null, sessionDir);
  },
  filename: (req, file, cb) => {
    const idx = parseInt(req.body.chunkIndex ?? req.query.chunkIndex, 10);
    if (isNaN(idx) || idx < 0) return cb(new Error('Invalid chunkIndex'));
    cb(null, `chunk-${String(idx).padStart(6, '0')}.webm`);
  }
});

const chunkUpload = multer({
  storage: chunkStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB per chunk
});

// POST /api/videos/chunk — upload a single recording chunk (public)
router.post('/chunk', chunkUpload.single('chunk'), (req, res) => {
  if (!req.file) {
    console.warn('[chunk] No chunk file in request', { sessionId: req.body.sessionId, chunkIndex: req.body.chunkIndex });
    return res.status(400).json({ error: 'No chunk provided' });
  }
  console.log('[chunk] Saved chunk', { sessionId: req.body.sessionId, chunkIndex: req.body.chunkIndex, size: req.file.size });
  res.json({ success: true, chunkIndex: req.body.chunkIndex });
});

// POST /api/videos/finalize — combine chunks into final video, create DB entry (public)
// Accepts both application/json and text/plain (sendBeacon sends text/plain on some browsers)
router.post('/finalize', express.json(), express.text(), (req, res) => {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  const { sessionId, mimeType, duration } = body || {};
  if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid sessionId' });
  }

  const sessionDir = path.join(CHUNKS_DIR, sessionId);
  if (!fs.existsSync(sessionDir)) {
    return res.status(404).json({ error: 'No chunks found for session' });
  }

  // Check if already finalized (prevent duplicate)
  const db = getDb();
  const existing = db.prepare('SELECT id FROM recordings WHERE session_id = ? AND status = ?').get(sessionId, 'complete');
  if (existing) {
    console.log('[finalize] Duplicate finalize skipped', { sessionId, existingId: existing.id });
    // Already finalized, clean up chunks dir if it still exists
    fs.rmSync(sessionDir, { recursive: true, force: true });
    return res.json({ success: true, id: existing.id, duplicate: true });
  }

  // Read and sort chunk files
  const chunkFiles = fs.readdirSync(sessionDir)
    .filter(f => f.startsWith('chunk-') && f.endsWith('.webm'))
    .sort();

  if (chunkFiles.length === 0) {
    return res.status(400).json({ error: 'No chunk files found' });
  }

  // Concatenate chunks into final file
  const id = uuidv4();
  const finalFilename = `${id}.webm`;
  const finalPath = path.join(UPLOADS_DIR, finalFilename);
  const writeStream = fs.createWriteStream(finalPath);

  for (const chunkFile of chunkFiles) {
    const chunkPath = path.join(sessionDir, chunkFile);
    const data = fs.readFileSync(chunkPath);
    writeStream.write(data);
  }
  writeStream.end();

  writeStream.on('finish', () => {
    const stat = fs.statSync(finalPath);
    const dur = parseFloat(duration) || 0;

    // Remove any partial DB entry for this session
    const deleted = db.prepare('DELETE FROM recordings WHERE session_id = ? AND status = ?').run(sessionId, 'partial');
    if (deleted.changes > 0) {
      console.log('[finalize] Removed partial entry', { sessionId, deletedCount: deleted.changes });
    }

    db.prepare(`
      INSERT INTO recordings (id, filename, original_name, mime_type, file_size, duration, session_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'complete')
    `).run(
      id,
      finalFilename,
      `recording-${sessionId}.webm`,
      mimeType || 'video/webm',
      stat.size,
      dur,
      sessionId
    );

    console.log('[finalize] Recording created', { id, sessionId, fileSize: stat.size, duration: dur, chunks: chunkFiles.length });

    // Clean up chunks directory
    fs.rmSync(sessionDir, { recursive: true, force: true });

    res.json({ success: true, id, sessionId });
  });

  writeStream.on('error', (err) => {
    console.error('[finalize] Failed to assemble video', { sessionId, error: err.message });
    res.status(500).json({ error: 'Failed to assemble video' });
  });
});

// POST /api/videos/upload - Legacy full-blob upload (public)
router.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }

  const db = getDb();
  const id = req.recordingId;
  const sessionId = req.body.sessionId || uuidv4();
  const duration = parseFloat(req.body.duration) || 0;

  db.prepare(`
    INSERT INTO recordings (id, filename, original_name, mime_type, file_size, duration, session_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'complete')
  `).run(
    id,
    req.file.filename,
    req.file.originalname,
    req.file.mimetype,
    req.file.size,
    duration,
    sessionId
  );

  console.log('[upload] Recording created (legacy)', { id, sessionId, fileSize: req.file.size, duration });
  res.json({ success: true, id, sessionId });
});

// GET /api/videos - Admin: list all recordings
router.get('/', authMiddleware, (req, res) => {
  const db = getDb();
  const { search, sort = 'created_at', order = 'DESC', page = 1, limit = 20 } = req.query;

  const allowedSorts = ['created_at', 'file_size', 'duration'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  let where = '';
  const params = [];

  if (search) {
    where = 'WHERE session_id LIKE ? OR id LIKE ?';
    params.push(`%${search}%`, `%${search}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM recordings ${where}`).get(...params).count;
  const recordings = db.prepare(
    `SELECT * FROM recordings ${where} ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`
  ).all(...params, parseInt(limit), offset);

  console.log('[list] Recordings fetched', { total, returned: recordings.length, page: parseInt(page), limit: parseInt(limit), search: search || null });
  res.json({ recordings, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/videos/stats - Admin: dashboard stats
router.get('/stats', authMiddleware, (req, res) => {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as count FROM recordings').get().count;
  const totalSize = db.prepare('SELECT COALESCE(SUM(file_size), 0) as size FROM recordings').get().size;
  const totalDuration = db.prepare('SELECT COALESCE(SUM(duration), 0) as dur FROM recordings').get().dur;
  const today = db.prepare(
    "SELECT COUNT(*) as count FROM recordings WHERE date(created_at) = date('now')"
  ).get().count;

  console.log('[stats] Dashboard stats', { total, totalSize, totalDuration, today });
  res.json({ total, totalSize, totalDuration, today });
});

// GET /api/videos/:id/stream - Admin: stream video
router.get('/:id/stream', authMiddleware, (req, res) => {
  const db = getDb();
  const recording = db.prepare('SELECT * FROM recordings WHERE id = ?').get(req.params.id);

  if (!recording) {
    return res.status(404).json({ error: 'Recording not found' });
  }

  const filePath = path.join(UPLOADS_DIR, recording.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video file not found on disk' });
  }

  const stat = fs.statSync(filePath);
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': recording.mime_type
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': recording.mime_type
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// DELETE /api/videos/:id - Admin: delete recording
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const recording = db.prepare('SELECT * FROM recordings WHERE id = ?').get(req.params.id);

  if (!recording) {
    return res.status(404).json({ error: 'Recording not found' });
  }

  const filePath = path.join(UPLOADS_DIR, recording.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  db.prepare('DELETE FROM recordings WHERE id = ?').run(req.params.id);
  console.log('[delete] Recording deleted', { id: req.params.id, filename: recording.filename });
  res.json({ success: true });
});

module.exports = router;
