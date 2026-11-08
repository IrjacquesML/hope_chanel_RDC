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
  /** Envoie une vidéo telle quelle ; onProgress reçoit le pourcentage envoyé. */
  uploadVideo: (file, onProgress) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload/video');
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => {
        let data = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          /* réponse vide ou page d'erreur du proxy */
        }
        if (xhr.status >= 200 && xhr.status < 300 && data?.url) return resolve(data);
        reject(new Error(data?.error || (xhr.status === 413 ? 'Vidéo trop lourde pour le serveur' : `Erreur ${xhr.status}`)));
      };
      xhr.onerror = () => reject(new Error('Envoi interrompu : vérifiez la connexion et réessayez'));
      xhr.send(file);
    }),
  backups: () => request('/api/backups'),
  stats: (query) => request(`/api/stats?${query}`, { cache: 'no-store' }),
  reportsConfig: () => request('/api/reports/config', { cache: 'no-store' }),
  saveReportsConfig: (body) => request('/api/reports/config', { method: 'PUT', body }),
  /** Rapport d'audience en PDF : renvoie le fichier (Blob) et son nom. */
  async reportPdf(body) {
    const res = await fetch('/api/stats/report.pdf', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const err = new Error(data?.error || `Erreur ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'rapport.pdf';
    return { blob: await res.blob(), name };
  },
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
  // Synchronisation des réseaux sociaux
  social: () => request('/api/social', { cache: 'no-store' }),
  saveSocialConfig: (config) => request('/api/social/config', { method: 'PUT', body: config }),
  socialSync: () => request('/api/social/sync', { method: 'POST' }),
  socialStatus: (key, status) => request(`/api/social/items/${encodeURIComponent(key)}`, { method: 'PATCH', body: { status } }),
  socialToArticle: (key) => request(`/api/social/items/${encodeURIComponent(key)}/article`, { method: 'POST' }),
};

/** Convertit une image (fichier ou adresse, tout format lisible par le navigateur) en PNG, pour le PDF. */
export function imageToPng(source, maxSize = 1200) {
  return new Promise((resolve, reject) => {
    const url = typeof source === 'string' ? source : URL.createObjectURL(source);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      if (typeof source !== 'string') URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error('Image illisible'));
    image.src = url;
  });
}

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
