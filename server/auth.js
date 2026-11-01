// Comptes de l'administration : utilisateurs, rôles, sessions, mots de passe, codes de secours et journal des connexions.
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const ROLES = {
  admin: 'Administrateur',
  editor: 'Rédacteur',
  technician: 'Technicien régie',
};

/**
 * Ce que chaque rôle (hors administrateur) peut modifier dans les fichiers de données.
 * null = tout le fichier ; liste = uniquement ces sections.
 */
const WRITABLE = {
  editor: { shows: null, schedule: null, content: ['events', 'news', 'team', 'testimonials', 'network'] },
  technician: { content: ['live'] },
};

const SESSION_HOURS = 8;
const LOG_MAX = 500;
const COOKIE = 'hc_admin';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COMMON_PASSWORDS = ['motdepasse', 'password', 'azerty', 'qwerty', '123456', 'hopechannel', 'hopechanel', 'admin', 'kinshasa'];

/* ---------- Outils cryptographiques ---------- */

function hashSecret(secret, cost = 16384) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${cost}$${salt}$${crypto.scryptSync(String(secret), salt, 64, { N: cost }).toString('hex')}`;
}

function verifySecret(secret, stored) {
  if (!stored) return false;
  const parts = stored.split('$');
  // Ancien format (scrypt$sel$hash, coût par défaut) accepté pour la migration
  const [cost, salt, hash] = parts.length === 3 ? [16384, parts[1], parts[2]] : [Number(parts[1]), parts[2], parts[3]];
  const candidate = crypto.scryptSync(String(secret), salt, 64, { N: cost });
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

// Empreinte factice : la vérification prend le même temps que l'e-mail existe ou non.
const DUMMY_HASH = hashSecret(crypto.randomBytes(16).toString('hex'));

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I
const randomChars = (n, alphabet = ALPHABET) => Array.from(crypto.randomBytes(n), (b) => alphabet[b % alphabet.length]).join('');

/** Mot de passe provisoire lisible, ex. « Kp7m-X2qr-9Tzw » (lettres et chiffres garantis). */
function temporaryPassword() {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  let p;
  do p = [randomChars(4, ALPHABET + lower), randomChars(4, ALPHABET + lower), randomChars(4, ALPHABET + lower)].join('-');
  while (!/\d/.test(p) || !/[a-z]/i.test(p));
  return p;
}

const normalizeCode = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Règles des mots de passe. Renvoie un message d'erreur ou null. */
export function passwordProblem(password, email = '') {
  const p = String(password || '');
  if (p.length < 10) return 'Le mot de passe doit faire au moins 10 caractères';
  if (p.length > 200) return 'Le mot de passe est trop long (200 caractères max.)';
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return 'Le mot de passe doit contenir des lettres et des chiffres';
  const lower = p.toLowerCase();
  const local = email.split('@')[0].toLowerCase();
  if (local.length >= 4 && lower.includes(local)) return 'Le mot de passe ne doit pas contenir votre adresse e-mail';
  if (COMMON_PASSWORDS.some((w) => lower.replace(/[^a-z]/g, '') === w)) return 'Ce mot de passe est trop courant';
  return null;
}

/** « Chrome · Windows » à partir de l'en-tête User-Agent. */
export function describeDevice(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone / iPad' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Système inconnu';
  return `${browser} · ${os}`;
}

/* ---------------------------------------------------------------- */

export function createAuth({ dbDir, prod, envEmail, envPassword, legacyAdmin }) {
  const USERS_FILE = path.join(dbDir, 'users.json');
  const LOG_FILE = path.join(dbDir, 'auth-log.json');

  /* ---------- Stockage ---------- */
  let users = [];
  let log = [];
  try {
    users = JSON.parse(readFileSync(USERS_FILE, 'utf8')).users;
  } catch {
    users = [];
  }
  try {
    log = JSON.parse(readFileSync(LOG_FILE, 'utf8'));
  } catch {
    log = [];
  }

  // Écritures en file d'attente : jamais deux écritures simultanées du même fichier.
  let queue = Promise.resolve();
  const writeJson = (file, data) => {
    queue = queue.then(async () => {
      const tmp = file + '.tmp';
      await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
      await fs.rename(tmp, file);
    });
    return queue;
  };
  const saveUsers = () => writeJson(USERS_FILE, { users });

  const now = () => new Date().toISOString();

  function makeUser({ name, email, role, passwordHash, mustChangePassword = false }) {
    return {
      id: `u-${crypto.randomBytes(6).toString('hex')}`,
      name,
      email,
      role,
      avatar: '',
      active: true,
      passwordHash,
      mustChangePassword,
      recoveryCodes: [],
      createdAt: now(),
      updatedAt: now(),
      passwordChangedAt: now(),
      lastLoginAt: null,
    };
  }

  /* Premier démarrage : le compte du fichier .env (ou l'ancien compte unique) devient le premier administrateur. */
  if (!users.length) {
    const email = (legacyAdmin?.email || envEmail || '').trim().toLowerCase();
    const passwordHash = legacyAdmin?.passwordHash || (envPassword && envPassword.length >= 8 ? hashSecret(envPassword) : '');
    if (!email || !passwordHash) {
      console.error('Aucun compte administrateur : définissez ADMIN_EMAIL et ADMIN_PASSWORD (8 caractères min.) dans le fichier .env');
      process.exit(1);
    }
    users.push(makeUser({ name: 'Administrateur', email, role: 'admin', passwordHash }));
    saveUsers();
    console.log(`Compte administrateur créé : ${email}`);
  }

  /* Secours : ADMIN_RESET=1 redonne au compte ADMIN_EMAIL le mot de passe ADMIN_PASSWORD (administrateur actif). */
  if (process.env.ADMIN_RESET === '1') {
    if (!envEmail || !envPassword || envPassword.length < 8) {
      console.error('ADMIN_RESET=1 exige ADMIN_EMAIL et ADMIN_PASSWORD dans le fichier .env');
      process.exit(1);
    }
    let u = users.find((x) => x.email === envEmail);
    if (!u) users.push((u = makeUser({ name: 'Administrateur', email: envEmail, role: 'admin', passwordHash: '' })));
    Object.assign(u, { role: 'admin', active: true, passwordHash: hashSecret(envPassword), mustChangePassword: true, updatedAt: now(), passwordChangedAt: now() });
    saveUsers();
    console.warn(`ADMIN_RESET : le compte ${envEmail} a retrouvé le mot de passe du fichier .env (à changer à la connexion). Retirez ADMIN_RESET=1 du fichier .env.`);
  }

  const byId = (id) => users.find((u) => u.id === id);
  const byEmail = (email) => users.find((u) => u.email === String(email || '').trim().toLowerCase());
  const activeAdmins = () => users.filter((u) => u.role === 'admin' && u.active);

  /** Données d'un compte sans les secrets. */
  const publicUser = (u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    roleLabel: ROLES[u.role],
    avatar: u.avatar,
    active: u.active,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt,
    passwordChangedAt: u.passwordChangedAt,
    lastLoginAt: u.lastLoginAt,
    recoveryCodesLeft: u.recoveryCodes.length,
  });

  /* ---------- Journal ---------- */
  function record(req, event, user, extra = {}) {
    log.unshift({
      at: now(),
      event,
      userId: user?.id || null,
      email: user?.email || extra.email || null,
      by: req.user && req.user.id !== user?.id ? req.user.email : undefined,
      ip: req.ip,
      device: describeDevice(req.get('user-agent')),
      ...extra,
    });
    if (log.length > LOG_MAX) log.length = LOG_MAX;
    writeJson(LOG_FILE, log).catch((e) => console.error('auth-log', e));
  }

  /* ---------- Sessions (en mémoire : un redémarrage du serveur déconnecte tout le monde) ---------- */
  const sessions = new Map(); // jeton -> { id, userId, createdAt, lastSeen, exp, ip, device }

  function readCookie(req) {
    const match = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
    return match ? decodeURIComponent(match.slice(COOKIE.length + 1)) : null;
  }

  function setCookie(res, token, maxAgeSec) {
    const parts = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSec}`];
    if (prod) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
  }

  function openSession(req, res, user) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
      id: crypto.createHash('sha256').update(token).digest('hex').slice(0, 16),
      userId: user.id,
      createdAt: now(),
      lastSeen: now(),
      exp: Date.now() + SESSION_HOURS * 3600_000,
      ip: req.ip,
      device: describeDevice(req.get('user-agent')),
    });
    setCookie(res, token, SESSION_HOURS * 3600);
  }

  /** Ferme les sessions d'un compte, sauf éventuellement celle indiquée. Renvoie le nombre fermé. */
  function closeSessions(userId, exceptToken) {
    let n = 0;
    for (const [token, s] of sessions) if (s.userId === userId && token !== exceptToken) sessions.delete(token) && n++;
    return n;
  }

  const sessionsOf = (userId) => [...sessions.values()].filter((s) => s.userId === userId && s.exp > Date.now());

  /** Session et compte de la requête, ou null. */
  function resolve(req) {
    const token = readCookie(req);
    const s = token && sessions.get(token);
    if (!s) return null;
    const user = byId(s.userId);
    if (s.exp < Date.now() || !user || !user.active) {
      sessions.delete(token);
      return null;
    }
    s.lastSeen = now();
    return { token, session: s, user };
  }

  const isAuthed = (req) => Boolean(resolve(req));

  /** Exige une connexion. Un compte qui doit changer son mot de passe n'a accès à rien d'autre. */
  function requireAuth(req, res, next) {
    const r = resolve(req);
    if (!r) return res.status(401).json({ error: 'Non authentifié' });
    req.user = r.user;
    req.session = r.session;
    req.sessionToken = r.token;
    if (r.user.mustChangePassword && !req.allowPending) {
      return res.status(403).json({ error: 'Vous devez d’abord choisir un nouveau mot de passe', code: 'MUST_CHANGE_PASSWORD' });
    }
    next();
  }
  const allowPending = (req, _res, next) => {
    req.allowPending = true;
    next();
  };

  const requireRole = (...roles) => [
    requireAuth,
    (req, res, next) => (roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Votre rôle ne permet pas cette action' })),
  ];

  /** Vérifie qu'un compte peut enregistrer ce fichier : seules les sections autorisées pour son rôle peuvent changer. */
  function canWriteFile(user, file, current, next) {
    if (user.role === 'admin') return null;
    const rules = WRITABLE[user.role] || {};
    if (!(file in rules)) return 'Votre rôle ne permet pas de modifier ces données';
    const allowed = rules[file];
    if (allowed === null) return null;
    for (const key of new Set([...Object.keys(current), ...Object.keys(next)])) {
      if (!allowed.includes(key) && JSON.stringify(current[key]) !== JSON.stringify(next[key])) {
        return `Votre rôle ne permet pas de modifier la section « ${key} »`;
      }
    }
    return null;
  }

  /* ---------- Limitation des tentatives : 5 échecs par IP ou 10 par compte => blocage 15 min ---------- */
  const attempts = new Map();
  const WINDOW = 15 * 60_000;
  const blocked = (key, max) => {
    const a = attempts.get(key);
    return a && a.count >= max && Date.now() - a.first < WINDOW;
  };
  const fail = (key) => {
    const a = attempts.get(key);
    if (!a || Date.now() - a.first > WINDOW) attempts.set(key, { count: 1, first: Date.now() });
    else a.count++;
  };
  const tooMany = (req, email) => blocked(`ip:${req.ip}`, 5) || blocked(`user:${email}`, 10);
  const failed = (req, email) => {
    fail(`ip:${req.ip}`);
    fail(`user:${email}`);
  };

  /* ---------- Routes ---------- */
  const router = express.Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  router.post('/login', wrap(async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (tooMany(req, email)) return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' });
    const user = byEmail(email);
    const ok = verifySecret(req.body?.password ?? '', user?.passwordHash || DUMMY_HASH) && Boolean(user);
    if (!ok) {
      failed(req, email);
      record(req, 'login_fail', user, { email });
      return res.status(401).json({ error: 'E-mail ou mot de passe incorrect' });
    }
    if (!user.active) {
      record(req, 'login_disabled', user);
      return res.status(403).json({ error: 'Ce compte est désactivé. Contactez un administrateur.' });
    }
    attempts.delete(`ip:${req.ip}`);
    attempts.delete(`user:${email}`);
    user.lastLoginAt = now();
    await saveUsers();
    openSession(req, res, user);
    record(req, 'login', user);
    res.json({ ok: true, user: publicUser(user) });
  }));

  router.post('/logout', (req, res) => {
    const r = resolve(req);
    if (r) {
      sessions.delete(r.token);
      record(req, 'logout', r.user);
    }
    setCookie(res, '', 0);
    res.json({ ok: true });
  });

  router.get('/me', (req, res) => {
    const r = resolve(req);
    res.json(r ? { authenticated: true, user: publicUser(r.user) } : { authenticated: false });
  });

  /** Mot de passe oublié : e-mail + code de secours + nouveau mot de passe. */
  router.post('/auth/recover', wrap(async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (tooMany(req, email)) return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' });
    const user = byEmail(email);
    const code = normalizeCode(req.body?.code);
    const index = user && user.active ? user.recoveryCodes.findIndex((h) => verifySecret(code, h)) : -1;
    if (index < 0) {
      verifySecret(code, DUMMY_HASH);
      failed(req, email);
      record(req, 'recover_fail', user, { email });
      return res.status(401).json({ error: 'E-mail ou code de secours incorrect' });
    }
    const problem = passwordProblem(req.body?.password, email);
    if (problem) return res.status(400).json({ error: problem });
    user.recoveryCodes.splice(index, 1);
    Object.assign(user, { passwordHash: hashSecret(req.body.password), mustChangePassword: false, passwordChangedAt: now(), updatedAt: now() });
    await saveUsers();
    closeSessions(user.id);
    record(req, 'recover', user);
    res.json({ ok: true, recoveryCodesLeft: user.recoveryCodes.length });
  }));

  /* ---------- Mon compte ---------- */
  router.get('/account', requireAuth, (req, res) => {
    const u = req.user;
    res.set('Cache-Control', 'no-store').json({
      user: publicUser(u),
      sessions: sessionsOf(u.id).map((s) => ({ id: s.id, createdAt: s.createdAt, lastSeen: s.lastSeen, ip: s.ip, device: s.device, current: s.id === req.session.id })),
      history: log.filter((e) => e.userId === u.id).slice(0, 30),
    });
  });

  router.put('/account/profile', requireAuth, wrap(async (req, res) => {
    const u = req.user;
    const name = String(req.body?.name ?? '').trim().slice(0, 80);
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const avatar = String(req.body?.avatar ?? '').trim();
    if (!name) return res.status(400).json({ error: 'Le nom est obligatoire' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Adresse e-mail invalide' });
    if (avatar && !/^(\/uploads\/[\w.-]+|https:\/\/\S+)$/.test(avatar)) return res.status(400).json({ error: 'Photo invalide' });
    if (email !== u.email) {
      if (byEmail(email)) return res.status(409).json({ error: 'Cette adresse e-mail est déjà utilisée par un autre compte' });
      if (!verifySecret(req.body?.current ?? '', u.passwordHash)) return res.status(403).json({ error: 'Pour changer d’e-mail, saisissez votre mot de passe actuel' });
    }
    const emailChanged = email !== u.email;
    Object.assign(u, { name, email, avatar, updatedAt: now() });
    await saveUsers();
    record(req, emailChanged ? 'email_changed' : 'profile_updated', u);
    res.json({ user: publicUser(u) });
  }));

  router.post('/account/password', allowPending, requireAuth, wrap(async (req, res) => {
    const u = req.user;
    if (!verifySecret(req.body?.current ?? '', u.passwordHash)) return res.status(403).json({ error: 'Mot de passe actuel incorrect' });
    const problem = passwordProblem(req.body?.password, u.email);
    if (problem) return res.status(400).json({ error: problem });
    if (verifySecret(req.body.password, u.passwordHash)) return res.status(400).json({ error: 'Choisissez un mot de passe différent de l’actuel' });
    Object.assign(u, { passwordHash: hashSecret(req.body.password), mustChangePassword: false, passwordChangedAt: now(), updatedAt: now() });
    await saveUsers();
    const closed = closeSessions(u.id, req.sessionToken);
    record(req, 'password_changed', u, { closedSessions: closed });
    res.json({ ok: true, user: publicUser(u) });
  }));

  /** Génère 8 nouveaux codes de secours (remplace les anciens). Affichés une seule fois. */
  router.post('/account/recovery-codes', requireAuth, wrap(async (req, res) => {
    const u = req.user;
    if (!verifySecret(req.body?.current ?? '', u.passwordHash)) return res.status(403).json({ error: 'Mot de passe actuel incorrect' });
    const codes = Array.from({ length: 8 }, () => `${randomChars(4)}-${randomChars(4)}`);
    u.recoveryCodes = codes.map((c) => hashSecret(normalizeCode(c), 4096));
    u.updatedAt = now();
    await saveUsers();
    record(req, 'recovery_codes_generated', u);
    res.json({ codes });
  }));

  router.delete('/account/sessions/:id', requireAuth, (req, res) => {
    const entry = [...sessions.entries()].find(([, s]) => s.id === req.params.id && s.userId === req.user.id);
    if (!entry) return res.status(404).json({ error: 'Session introuvable' });
    sessions.delete(entry[0]);
    record(req, 'session_closed', req.user, { device: entry[1].device });
    res.json({ ok: true });
  });

  router.post('/account/sessions/close-others', requireAuth, (req, res) => {
    const n = closeSessions(req.user.id, req.sessionToken);
    record(req, 'sessions_closed', req.user, { closedSessions: n });
    res.json({ ok: true, closed: n });
  });

  /* ---------- Gestion des comptes (administrateurs) ---------- */
  const admin = requireRole('admin');

  const userInput = (body) => ({
    name: String(body?.name ?? '').trim().slice(0, 80),
    email: String(body?.email ?? '').trim().toLowerCase(),
    role: body?.role,
  });
  const inputProblem = ({ name, email, role }, self) => {
    if (!name) return 'Le nom est obligatoire';
    if (!EMAIL_RE.test(email)) return 'Adresse e-mail invalide';
    if (!(role in ROLES)) return 'Rôle inconnu';
    const other = byEmail(email);
    if (other && other.id !== self?.id) return 'Cette adresse e-mail est déjà utilisée par un autre compte';
    return null;
  };

  router.get('/users', admin, (_req, res) => {
    res.set('Cache-Control', 'no-store').json({
      roles: ROLES,
      users: users.map((u) => ({ ...publicUser(u), sessions: sessionsOf(u.id).length })),
      log: log.slice(0, 200),
    });
  });

  router.post('/users', admin, wrap(async (req, res) => {
    const input = userInput(req.body);
    const problem = inputProblem(input);
    if (problem) return res.status(400).json({ error: problem });
    const tempPassword = temporaryPassword();
    const u = makeUser({ ...input, passwordHash: hashSecret(tempPassword), mustChangePassword: true });
    users.push(u);
    await saveUsers();
    record(req, 'user_created', u, { role: input.role });
    res.status(201).json({ user: publicUser(u), tempPassword });
  }));

  router.put('/users/:id', admin, wrap(async (req, res) => {
    const u = byId(req.params.id);
    if (!u) return res.status(404).json({ error: 'Compte introuvable' });
    const input = userInput(req.body);
    const active = req.body?.active !== false;
    const problem = inputProblem(input, u);
    if (problem) return res.status(400).json({ error: problem });
    const self = u.id === req.user.id;
    if (self && (input.role !== u.role || !active)) return res.status(400).json({ error: 'Vous ne pouvez pas changer votre propre rôle ni désactiver votre propre compte' });
    if (u.role === 'admin' && u.active && (input.role !== 'admin' || !active) && activeAdmins().length === 1) {
      return res.status(400).json({ error: 'Il doit rester au moins un administrateur actif' });
    }
    const changes = [input.role !== u.role && 'role', active !== u.active && (active ? 'enabled' : 'disabled'), input.email !== u.email && 'email'].filter(Boolean);
    Object.assign(u, input, { active, updatedAt: now() });
    await saveUsers();
    if (!active) closeSessions(u.id);
    record(req, active ? 'user_updated' : 'user_disabled', u, { changes });
    res.json({ user: publicUser(u) });
  }));

  /** Réinitialisation par un administrateur : mot de passe provisoire à changer à la prochaine connexion. */
  router.post('/users/:id/reset-password', admin, wrap(async (req, res) => {
    const u = byId(req.params.id);
    if (!u) return res.status(404).json({ error: 'Compte introuvable' });
    if (u.id === req.user.id) return res.status(400).json({ error: 'Pour votre propre compte, utilisez « Mon compte »' });
    const tempPassword = temporaryPassword();
    Object.assign(u, { passwordHash: hashSecret(tempPassword), mustChangePassword: true, passwordChangedAt: now(), updatedAt: now() });
    await saveUsers();
    closeSessions(u.id);
    record(req, 'password_reset', u);
    res.json({ tempPassword });
  }));

  router.delete('/users/:id/sessions', admin, (req, res) => {
    const u = byId(req.params.id);
    if (!u) return res.status(404).json({ error: 'Compte introuvable' });
    const n = closeSessions(u.id, u.id === req.user.id ? req.sessionToken : undefined);
    record(req, 'sessions_closed', u, { closedSessions: n });
    res.json({ ok: true, closed: n });
  });

  router.delete('/users/:id', admin, wrap(async (req, res) => {
    const u = byId(req.params.id);
    if (!u) return res.status(404).json({ error: 'Compte introuvable' });
    if (u.id === req.user.id) return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    if (u.role === 'admin' && u.active && activeAdmins().length === 1) return res.status(400).json({ error: 'Il doit rester au moins un administrateur actif' });
    users = users.filter((x) => x.id !== u.id);
    await saveUsers();
    closeSessions(u.id);
    record(req, 'user_deleted', u);
    res.json({ ok: true });
  }));

  return { router, requireAuth, requireRole, isAuthed, canWriteFile };
}
