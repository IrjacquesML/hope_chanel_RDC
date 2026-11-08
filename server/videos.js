// Envoi des vidéos (émissions, épisodes) : le fichier est écrit au fil de l'eau, sans passer en mémoire.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createWriteStream, mkdirSync } from 'node:fs';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const MAX_VIDEO_BYTES = 2 * 1024 ** 3; // 2 Go
export const VIDEO_URL = /^\/uploads\/videos\/[\w.-]+\.(?:mp4|webm)$/;

const EXT = { 'video/mp4': 'mp4', 'video/webm': 'webm' };
const HEAD_BYTES = 12;

/** Le début du fichier correspond-il vraiment au format annoncé ? */
const validHead = (ext, head) => (ext === 'mp4' ? head.toString('latin1', 4, 8) === 'ftyp' : head.length >= 4 && head.readUInt32BE(0) === 0x1a45dfa3);

/** Route Express : le corps de la requête est le fichier lui-même, son type est donné par Content-Type. */
export function createVideoUpload({ dir, maxBytes = MAX_VIDEO_BYTES }) {
  mkdirSync(dir, { recursive: true });
  return async (req, res, next) => {
    const ext = EXT[(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()];
    if (!ext) return res.status(415).json({ error: 'Vidéo MP4 ou WebM attendue' });
    const tooBig = () => res.status(413).json({ error: `Vidéo trop lourde (${Math.round(maxBytes / 1024 ** 3)} Go max.)` });
    if (Number(req.headers['content-length']) > maxBytes) return tooBig();

    const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const final = path.join(dir, name);
    const part = `${final}.part`;
    let size = 0;
    let head = Buffer.alloc(0);
    let overLimit = false;
    const inspect = new Transform({
      transform(chunk, _enc, cb) {
        size += chunk.length;
        if (size > maxBytes) {
          overLimit = true;
          return cb(new Error('Vidéo trop lourde'));
        }
        if (head.length < HEAD_BYTES) head = Buffer.concat([head, chunk]).subarray(0, HEAD_BYTES);
        cb(null, chunk);
      },
    });

    try {
      await pipeline(req, inspect, createWriteStream(part, { flags: 'wx' }));
      if (!validHead(ext, head)) {
        await fs.unlink(part);
        return res.status(400).json({ error: 'Ce fichier n’est pas une vidéo MP4 ou WebM valide' });
      }
      await fs.rename(part, final);
      res.json({ url: `/uploads/videos/${name}` });
    } catch (e) {
      await fs.unlink(part).catch(() => {});
      if (overLimit) return res.headersSent ? undefined : tooBig();
      // Envoi interrompu par le navigateur (onglet fermé, réseau coupé) : rien à signaler
      if (req.aborted || e.code === 'ERR_STREAM_PREMATURE_CLOSE') return res.destroy();
      next(e);
    }
  };
}
