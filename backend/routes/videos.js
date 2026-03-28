const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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

// POST /api/videos/upload - Public endpoint for mirror recording
router.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }

  const db = getDb();
  const id = req.recordingId;
  const sessionId = req.body.sessionId || uuidv4();
  const duration = parseFloat(req.body.duration) || 0;

  db.prepare(`
    INSERT INTO recordings (id, filename, original_name, mime_type, file_size, duration, session_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.file.filename,
    req.file.originalname,
    req.file.mimetype,
    req.file.size,
    duration,
    sessionId
  );

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
  res.json({ success: true });
});

module.exports = router;
