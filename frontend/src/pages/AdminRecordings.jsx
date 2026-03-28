import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { verifyToken, getRecordings, deleteRecording, logout, getVideoStreamUrl } from '../utils/api';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'Z');
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export default function AdminRecordings() {
  const navigate = useNavigate();
  const [recordings, setRecordings] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);
  const [toast, setToast] = useState(null);

  const limit = 12;

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchRecordings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRecordings({ page, limit, search });
      setRecordings(data.recordings);
      setTotal(data.total);
    } catch {
      showToast('Failed to load recordings', 'error');
    }
    setLoading(false);
  }, [page, search, showToast]);

  useEffect(() => {
    (async () => {
      const valid = await verifyToken();
      if (!valid) {
        navigate('/admin');
        return;
      }
      fetchRecordings();
    })();
  }, [navigate, fetchRecordings]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this recording? This cannot be undone.')) return;
    try {
      await deleteRecording(id);
      showToast('Recording deleted');
      fetchRecordings();
    } catch {
      showToast('Failed to delete recording', 'error');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin');
  };

  const totalPages = Math.ceil(total / limit);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecordings();
    }, 400);
    return () => clearTimeout(timer);
  }, [search, fetchRecordings]);

  const getStreamUrl = getVideoStreamUrl;

  return (
    <div className="admin-layout">
      <nav className="admin-nav">
        <div className="admin-nav__brand">Mirror Admin</div>
        <div className="admin-nav__links">
          <Link to="/admin/dashboard" className="admin-nav__link">
            Dashboard
          </Link>
          <Link to="/admin/recordings" className="admin-nav__link admin-nav__link--active">
            Recordings
          </Link>
          <button className="admin-nav__logout" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </nav>

      <div className="admin-content">
        <div className="recordings__header">
          <div>
            <h1 className="recordings__title">Recordings</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
              {total} total recording{total !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="recordings__search">
            <input
              className="recordings__search-input"
              placeholder="Search by session ID..."
              value={search}
              onChange={handleSearch}
            />
          </div>
        </div>

        {loading && recordings.length === 0 ? (
          <div className="video-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="video-card">
                <div className="skeleton" style={{ aspectRatio: '16/9' }} />
                <div style={{ padding: 16 }}>
                  <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 12, width: '40%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : recordings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📹</div>
            <div className="empty-state__title">No recordings yet</div>
            <div className="empty-state__text">
              Recordings will appear here once users interact with the mirror.
            </div>
          </div>
        ) : (
          <>
            <div className="video-grid">
              {recordings.map((rec) => (
                <div key={rec.id} className="video-card">
                  <div className="video-card__preview">
                    <video
                      src={getStreamUrl(rec.id)}
                      preload="metadata"
                      muted
                      onMouseEnter={(e) => e.target.play().catch(() => {})}
                      onMouseLeave={(e) => { e.target.pause(); e.target.currentTime = 0; }}
                    />
                    <div
                      className="video-card__play-overlay"
                      onClick={() => setPlayingId(rec.id)}
                    >
                      <div className="video-card__play-btn">▶</div>
                    </div>
                  </div>
                  <div className="video-card__info">
                    <div className="video-card__session">
                      Session: {rec.session_id}
                    </div>
                    <div className="video-card__meta">
                      <span className="video-card__date">{formatDate(rec.created_at)}</span>
                      <span className="video-card__size">
                        {formatBytes(rec.file_size)} · {formatDuration(rec.duration)}
                      </span>
                    </div>
                    <div className="video-card__actions">
                      <button
                        className="video-card__action video-card__action--play"
                        onClick={() => setPlayingId(rec.id)}
                      >
                        ▶ Play
                      </button>
                      <button
                        className="video-card__action video-card__action--delete"
                        onClick={() => handleDelete(rec.id)}
                      >
                        ✕ Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination__btn"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  ← Prev
                </button>
                <span className="pagination__info">
                  Page {page} of {totalPages}
                </span>
                <button
                  className="pagination__btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Video Playback Modal */}
      {playingId && (
        <div className="video-modal-overlay" onClick={() => setPlayingId(null)}>
          <div className="video-modal" onClick={(e) => e.stopPropagation()}>
            <div className="video-modal__header">
              <span className="video-modal__title">Recording Playback</span>
              <button className="video-modal__close" onClick={() => setPlayingId(null)}>
                ✕
              </button>
            </div>
            <div className="video-modal__body">
              <video
                src={getStreamUrl(playingId)}
                controls
                autoPlay
              />
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast--${toast.type}`}>{toast.message}</div>
        </div>
      )}
    </div>
  );
}
