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
