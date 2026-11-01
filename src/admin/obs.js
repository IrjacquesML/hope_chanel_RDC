/**
 * Client minimal du protocole obs-websocket v5 (intégré à OBS Studio 28+ : Outils → Paramètres du serveur WebSocket).
 * La connexion part du navigateur de l'administrateur : OBS doit tourner sur ce PC (localhost) ou être joignable sur le réseau.
 */

const sha256Base64 = async (text) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
};

const OP = { Hello: 0, Identify: 1, Identified: 2, Request: 6, RequestResponse: 7 };

export class ObsClient {
  constructor() {
    this.ws = null;
    this.pending = new Map();
    this.seq = 0;
    this.onClose = null;
  }

  /** Ouvre la connexion et s'authentifie. Rejette avec un message lisible en cas d'échec. */
  connect(host, port, password) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (msg) => {
        if (settled) return;
        settled = true;
        this.ws?.close();
        reject(new Error(msg));
      };
      let ws;
      try {
        ws = new WebSocket(`ws://${host}:${port}`);
      } catch {
        return fail('Adresse OBS invalide.');
      }
      this.ws = ws;
      const timer = setTimeout(() => fail('OBS ne répond pas (délai dépassé).'), 6000);

      ws.onerror = () =>
        fail(
          location.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(host)
            ? 'Connexion bloquée : depuis un site en https, le navigateur n’autorise OBS que sur ce PC (localhost). Ouvrez l’administration sur le PC qui fait tourner OBS.'
            : `Impossible de joindre OBS sur ${host}:${port}. Vérifiez qu’OBS est ouvert et que le serveur WebSocket est activé.`,
        );
      ws.onclose = (e) => {
        clearTimeout(timer);
        if (!settled) fail(e.code === 4009 ? 'Mot de passe OBS incorrect.' : `Connexion à OBS fermée (code ${e.code}).`);
        for (const { reject: rej } of this.pending.values()) rej(new Error('Connexion à OBS perdue'));
        this.pending.clear();
        this.ws = null;
        this.onClose?.();
      };
      ws.onmessage = async (event) => {
        const { op, d } = JSON.parse(event.data);
        if (op === OP.Hello) {
          const identify = { rpcVersion: 1 };
          if (d.authentication) {
            if (!password) return fail('OBS demande un mot de passe : renseignez-le ci-dessus.');
            if (!crypto.subtle) return fail('Ce navigateur bloque le chiffrement sur une adresse http : ouvrez l’administration via https:// ou http://localhost.');
            const secret = await sha256Base64(password + d.authentication.salt);
            identify.authentication = await sha256Base64(secret + d.authentication.challenge);
          }
          ws.send(JSON.stringify({ op: OP.Identify, d: identify }));
        } else if (op === OP.Identified) {
          clearTimeout(timer);
          settled = true;
          resolve();
        } else if (op === OP.RequestResponse) {
          const p = this.pending.get(d.requestId);
          if (!p) return;
          this.pending.delete(d.requestId);
          if (d.requestStatus.result) p.resolve(d.responseData || {});
          else p.reject(new Error(d.requestStatus.comment || `Erreur OBS ${d.requestStatus.code}`));
        }
      };
    });
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  request(requestType, requestData) {
    if (!this.connected) return Promise.reject(new Error('Non connecté à OBS'));
    const requestId = `r${++this.seq}`;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.ws.send(JSON.stringify({ op: OP.Request, d: { requestType, requestId, requestData } }));
    });
  }

  close() {
    this.ws?.close();
  }
}
