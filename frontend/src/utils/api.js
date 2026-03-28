const API_BASE = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('mirror_admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Login failed');
  }
  const data = await res.json();
  localStorage.setItem('mirror_admin_token', data.token);
  localStorage.setItem('mirror_admin_user', data.username);
  return data;
}

export async function verifyToken() {
  const res = await fetch(`${API_BASE}/auth/verify`, {
    headers: getAuthHeaders()
  });
  return res.ok;
}

export function logout() {
  localStorage.removeItem('mirror_admin_token');
  localStorage.removeItem('mirror_admin_user');
}

export async function getStats() {
  const res = await fetch(`${API_BASE}/videos/stats`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function getRecordings({ page = 1, limit = 20, search = '', sort = 'created_at', order = 'DESC' } = {}) {
  const params = new URLSearchParams({ page, limit, search, sort, order });
  const res = await fetch(`${API_BASE}/videos?${params}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch recordings');
  return res.json();
}

export async function deleteRecording(id) {
  const res = await fetch(`${API_BASE}/videos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete recording');
  return res.json();
}

export function getVideoStreamUrl(id) {
  const token = localStorage.getItem('mirror_admin_token');
  return `${API_BASE}/videos/${encodeURIComponent(id)}/stream?token=${encodeURIComponent(token)}`;
}

export async function uploadRecording(blob, sessionId, duration) {
  const formData = new FormData();
  formData.append('video', blob, `recording-${Date.now()}.webm`);
  formData.append('sessionId', sessionId);
  formData.append('duration', String(duration));

  const res = await fetch(`${API_BASE}/videos/upload`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Failed to upload recording');
  return res.json();
}
