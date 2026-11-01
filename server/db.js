// Stockage des comptes et du journal des connexions : base MySQL / MariaDB si MYSQL_DATABASE est défini, sinon fichiers db/*.json.
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const LOG_KEEP_DAYS = 365;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(32) NOT NULL PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    role ENUM('admin','editor','technician') NOT NULL,
    avatar VARCHAR(500) NOT NULL DEFAULT '',
    active TINYINT(1) NOT NULL DEFAULT 1,
    password_hash VARCHAR(255) NOT NULL,
    must_change_password TINYINT(1) NOT NULL DEFAULT 0,
    recovery_codes TEXT NOT NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    password_changed_at DATETIME(3) NOT NULL,
    last_login_at DATETIME(3) NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS auth_log (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    at DATETIME(3) NOT NULL,
    event VARCHAR(40) NOT NULL,
    user_id VARCHAR(32) NULL,
    email VARCHAR(190) NULL,
    by_email VARCHAR(190) NULL,
    ip VARCHAR(64) NULL,
    device VARCHAR(120) NULL,
    extra TEXT NULL,
    INDEX idx_at (at),
    INDEX idx_user (user_id, at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

const toDate = (iso) => (iso ? new Date(iso) : null);
const toIso = (d) => (d ? new Date(d).toISOString() : null);

/* ---------- Fichiers JSON (sans MySQL) ---------- */
function jsonStore(dbDir) {
  const USERS_FILE = path.join(dbDir, 'users.json');
  const LOG_FILE = path.join(dbDir, 'auth-log.json');
  const read = (file, fallback) => {
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      return fallback;
    }
  };
  const write = async (file, data) => {
    const tmp = file + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    await fs.rename(tmp, file);
  };
  let log = read(LOG_FILE, []);
  return {
    kind: 'fichiers JSON',
    loadUsers: async () => read(USERS_FILE, { users: [] }).users,
    saveUsers: (users) => write(USERS_FILE, { users }),
    loadLog: async (limit) => log.slice(0, limit),
    addLog: (entry, limit) => {
      log.unshift(entry);
      if (log.length > limit) log.length = limit;
      return write(LOG_FILE, log);
    },
  };
}

/* ---------- MySQL / MariaDB ---------- */
const rowToUser = (r) => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role,
  avatar: r.avatar,
  active: Boolean(r.active),
  passwordHash: r.password_hash,
  mustChangePassword: Boolean(r.must_change_password),
  recoveryCodes: JSON.parse(r.recovery_codes || '[]'),
  createdAt: toIso(r.created_at),
  updatedAt: toIso(r.updated_at),
  passwordChangedAt: toIso(r.password_changed_at),
  lastLoginAt: toIso(r.last_login_at),
});

const userToRow = (u) => [
  u.id,
  u.name,
  u.email,
  u.role,
  u.avatar || '',
  u.active ? 1 : 0,
  u.passwordHash,
  u.mustChangePassword ? 1 : 0,
  JSON.stringify(u.recoveryCodes || []),
  toDate(u.createdAt),
  toDate(u.updatedAt),
  toDate(u.passwordChangedAt || u.createdAt),
  toDate(u.lastLoginAt),
];

const rowToLog = (r) => ({
  at: toIso(r.at),
  event: r.event,
  userId: r.user_id,
  email: r.email,
  ...(r.by_email ? { by: r.by_email } : {}),
  ip: r.ip,
  device: r.device,
  ...JSON.parse(r.extra || '{}'),
});

async function mysqlStore(dbDir) {
  const { default: mysql } = await import('mysql2/promise');
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE,
    timezone: 'Z', // dates enregistrées en UTC
    charset: 'utf8mb4',
    connectionLimit: 5,
  });
  try {
    for (const sql of SCHEMA) await pool.query(sql);
  } catch (e) {
    console.error(`Base MySQL « ${process.env.MYSQL_DATABASE} » injoignable (${e.code || e.message}). Vérifiez MySQL et les réglages MYSQL_* du fichier .env.`);
    process.exit(1);
  }

  const insertLog = (conn, e) => {
    const { at, event, userId, email, by, ip, device, ...extra } = e;
    return conn.query('INSERT INTO auth_log (at, event, user_id, email, by_email, ip, device, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      toDate(at),
      event,
      userId || null,
      email || null,
      by || null,
      ip || null,
      device ? String(device).slice(0, 120) : null,
      Object.keys(extra).length ? JSON.stringify(extra) : null,
    ]);
  };

  const store = {
    kind: `MySQL (${process.env.MYSQL_DATABASE})`,
    async loadUsers() {
      const [rows] = await pool.query('SELECT * FROM users ORDER BY created_at');
      return rows.map(rowToUser);
    },
    /** Enregistre la liste complète des comptes (quelques comptes seulement) en une transaction. */
    async saveUsers(users) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        for (const u of users) {
          await conn.query(
            `INSERT INTO users (id, name, email, role, avatar, active, password_hash, must_change_password, recovery_codes, created_at, updated_at, password_changed_at, last_login_at)
             VALUES (?) ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), role = VALUES(role), avatar = VALUES(avatar), active = VALUES(active),
             password_hash = VALUES(password_hash), must_change_password = VALUES(must_change_password), recovery_codes = VALUES(recovery_codes),
             updated_at = VALUES(updated_at), password_changed_at = VALUES(password_changed_at), last_login_at = VALUES(last_login_at)`,
            [userToRow(u)],
          );
        }
        if (users.length) await conn.query('DELETE FROM users WHERE id NOT IN (?)', [users.map((u) => u.id)]);
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },
    async loadLog(limit) {
      const [rows] = await pool.query('SELECT * FROM auth_log ORDER BY at DESC, id DESC LIMIT ?', [limit]);
      return rows.map(rowToLog);
    },
    addLog: (entry) => insertLog(pool, entry),
  };

  // Journal : on garde un an d'historique
  await pool.query('DELETE FROM auth_log WHERE at < UTC_TIMESTAMP() - INTERVAL ? DAY', [LOG_KEEP_DAYS]);

  // Première utilisation de MySQL : reprise des comptes et du journal des fichiers db/*.json
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM users');
  if (!n) {
    const old = jsonStore(dbDir);
    const users = await old.loadUsers();
    if (users.length) {
      await store.saveUsers(users);
      const log = await old.loadLog(Infinity);
      for (const e of log.reverse()) await insertLog(pool, e);
      console.log(`MySQL : ${users.length} compte(s) et ${log.length} ligne(s) du journal repris des fichiers db/users.json et db/auth-log.json`);
    }
  }
  return store;
}

/** Stockage des comptes : MySQL si MYSQL_DATABASE est défini dans .env, sinon fichiers JSON. */
export const openStore = (dbDir) => (process.env.MYSQL_DATABASE ? mysqlStore(dbDir) : jsonStore(dbDir));
