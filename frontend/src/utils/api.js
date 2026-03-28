const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '') + '/api';

async function safeJson(res) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { error: text }; }
}

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
  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data.error || 'Login failed');
  }
  if (!data.token) {
    throw new Error('Invalid response from server');
  }
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
  return safeJson(res);
}

export async function getRecordings({ page = 1, limit = 20, search = '', sort = 'created_at', order = 'DESC' } = {}) {
  const params = new URLSearchParams({ page, limit, search, sort, order });
  const res = await fetch(`${API_BASE}/videos?${params}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch recordings');
  return safeJson(res);
}

export async function deleteRecording(id) {
  const res = await fetch(`${API_BASE}/videos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete recording');
  return safeJson(res);
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
  return safeJson(res);
}

// Last-resort upload via sendBeacon — works during page unload
export function beaconUpload(blob, sessionId, duration) {
  const formData = new FormData();
  formData.append('video', blob, `recording-${Date.now()}.webm`);
  formData.append('sessionId', sessionId);
  formData.append('duration', String(duration));
  navigator.sendBeacon(`${API_BASE}/videos/upload`, formData);
}
