async function request(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* réponse vide */
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Erreur ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  me: () => request('/api/me'),
  login: (email, password) => request('/api/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/api/logout', { method: 'POST' }),
  load: () => request('/api/data', { cache: 'no-store' }),
  save: (file, data) => request(`/api/data/${file}`, { method: 'PUT', body: data }),
  upload: (dataUrl) => request('/api/upload', { method: 'POST', body: { dataUrl } }),
  backups: () => request('/api/backups'),
  stats: (days) => request(`/api/stats?days=${days}`, { cache: 'no-store' }),
  restore: (name) => request(`/api/backups/${encodeURIComponent(name)}/restore`, { method: 'POST' }),
  privateSettings: () => request('/api/private', { cache: 'no-store' }),
  saveStreaming: (streaming) => request('/api/private/streaming', { method: 'PUT', body: streaming }),
  recover: (body) => request('/api/auth/recover', { method: 'POST', body }),
  // Mon compte
  account: () => request('/api/account', { cache: 'no-store' }),
  saveProfile: (body) => request('/api/account/profile', { method: 'PUT', body }),
  changePassword: (current, password) => request('/api/account/password', { method: 'POST', body: { current, password } }),
  recoveryCodes: (current) => request('/api/account/recovery-codes', { method: 'POST', body: { current } }),
  closeSession: (id) => request(`/api/account/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  closeOtherSessions: () => request('/api/account/sessions/close-others', { method: 'POST' }),
  // Comptes (administrateurs)
  users: () => request('/api/users', { cache: 'no-store' }),
  createUser: (body) => request('/api/users', { method: 'POST', body }),
  updateUser: (id, body) => request(`/api/users/${encodeURIComponent(id)}`, { method: 'PUT', body }),
  resetUserPassword: (id) => request(`/api/users/${encodeURIComponent(id)}/reset-password`, { method: 'POST' }),
  closeUserSessions: (id) => request(`/api/users/${encodeURIComponent(id)}/sessions`, { method: 'DELETE' }),
  deleteUser: (id) => request(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  vmixStatus: () => request('/api/vmix/status', { cache: 'no-store' }),
  vmixFunction: (name, input) => request('/api/vmix/function', { method: 'POST', body: { name, input } }),
  selfhostStatus: () => request('/api/selfhost/status', { cache: 'no-store' }),
  selfhostNewKey: () => request('/api/selfhost/key', { method: 'POST', body: {} }),
};

/** Redimensionne une image (1600 px max.) et la convertit en WebP avant envoi. */
export function imageToWebp(file, maxSize = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/webp', 0.82));
    };
    image.onerror = () => reject(new Error('Image illisible'));
    image.src = url;
  });
}
