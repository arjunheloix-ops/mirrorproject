import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { verifyToken, getStats, logout } from '../utils/api';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const valid = await verifyToken();
      if (!valid) {
        navigate('/admin');
        return;
      }
      try {
        const data = await getStats();
        setStats(data);
      } catch {
        // stats fail silently
      }
      setLoading(false);
    })();
  }, [navigate]);

  const handleLogout = () => {
    logout();
    navigate('/admin');
  };

  if (loading) {
    return (
      <div className="admin-layout">
        <div className="admin-content" style={{ textAlign: 'center', paddingTop: 80 }}>
          <div className="mirror-loading__spinner" style={{ margin: '0 auto' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <nav className="admin-nav">
        <div className="admin-nav__brand">Mirror Admin</div>
        <div className="admin-nav__links">
          <Link to="/admin/dashboard" className="admin-nav__link admin-nav__link--active">
            Dashboard
          </Link>
          <Link to="/admin/recordings" className="admin-nav__link">
            Recordings
          </Link>
          <button className="admin-nav__logout" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </nav>

      <div className="admin-content">
        <div className="dashboard__header">
          <h1 className="dashboard__title">Dashboard</h1>
          <p className="dashboard__subtitle">Overview of your mirror recordings</p>
        </div>

        <div className="dashboard__stats">
          <div className="stat-card">
            <div className="stat-card__label">Total Recordings</div>
            <div className="stat-card__value">{stats?.total ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Today</div>
            <div className="stat-card__value">{stats?.today ?? 0}</div>
            <div className="stat-card__sub">recordings today</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Total Storage</div>
            <div className="stat-card__value">{formatBytes(stats?.totalSize)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Total Duration</div>
            <div className="stat-card__value">{formatDuration(stats?.totalDuration)}</div>
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <Link
            to="/admin/recordings"
            className="mirror-btn mirror-btn--record"
            style={{ textDecoration: 'none' }}
          >
            View All Recordings →
          </Link>
        </div>
      </div>
    </div>
  );
}
