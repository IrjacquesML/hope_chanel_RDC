import { useId, useState } from 'react';
import { img } from '../lib';

/* Mêmes règles que le serveur (server/auth.js), pour prévenir avant l'envoi. */
const COMMON = ['motdepasse', 'password', 'azerty', 'qwerty', '123456', 'hopechannel', 'hopechanel', 'admin', 'kinshasa'];

export function passwordProblem(password, email = '') {
  const p = password || '';
  if (p.length < 10) return 'Au moins 10 caractères';
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return 'Des lettres et des chiffres';
  const local = email.split('@')[0].toLowerCase();
  if (local.length >= 4 && p.toLowerCase().includes(local)) return 'Ne doit pas contenir votre adresse e-mail';
  if (COMMON.includes(p.toLowerCase().replace(/[^a-z]/g, ''))) return 'Mot de passe trop courant';
  return null;
}

function strength(p) {
  let score = 0;
  if (p.length >= 10) score++;
  if (p.length >= 14) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[^a-zA-Z0-9]/.test(p)) score++;
  return [
    ['Très faible', 'bg-red-600'],
    ['Faible', 'bg-red-500'],
    ['Moyen', 'bg-amber-500'],
    ['Bon', 'bg-green-600'],
    ['Excellent', 'bg-green-700'],
  ][Math.max(0, score - 1)].concat(score);
}

/** Champ mot de passe avec bouton Afficher / Masquer. */
export function PasswordInput({ id, label, value, onChange, autoComplete = 'current-password', required, hint, children }) {
  const auto = useId();
  const inputId = id || auto;
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label htmlFor={inputId} className="label">
        {label} {required && <span className="text-red-600" aria-hidden="true">*</span>}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input pr-24"
          required={required}
          spellCheck={false}
        />
        <button type="button" onClick={() => setShown((v) => !v)} className="absolute inset-y-0 right-2 my-auto h-8 rounded-lg px-2 text-xs font-semibold text-brand hover:bg-brand/10">
          {shown ? 'Masquer' : 'Afficher'}
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {children}
    </div>
  );
}

/** Nouveau mot de passe + confirmation, avec jauge de solidité et règles. */
export function NewPasswordFields({ password, confirm, onPassword, onConfirm, email }) {
  const problem = password && passwordProblem(password, email);
  const [label, color, score] = strength(password || '');
  return (
    <>
      <PasswordInput label="Nouveau mot de passe" value={password} onChange={onPassword} autoComplete="new-password" required>
        {password ? (
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200"><span className={`block h-full transition-all ${color}`} style={{ width: `${score * 20}%` }} /></span>
              <span className="w-20 text-right text-xs text-gray-600">{label}</span>
            </div>
            {problem && <p className="mt-1 text-xs text-red-700">{problem}</p>}
          </div>
        ) : (
          <p className="mt-1 text-xs text-gray-500">10 caractères minimum, avec lettres et chiffres. Une phrase facile à retenir est idéale.</p>
        )}
      </PasswordInput>
      <PasswordInput label="Confirmer le nouveau mot de passe" value={confirm} onChange={onConfirm} autoComplete="new-password" required>
        {confirm && confirm !== password && <p className="mt-1 text-xs text-red-700">Les deux mots de passe ne correspondent pas</p>}
      </PasswordInput>
    </>
  );
}

export const newPasswordReady = (password, confirm, email) => Boolean(password) && !passwordProblem(password, email) && password === confirm;

/** Photo du compte, ou initiales sur fond de couleur. */
export function Avatar({ user, size = 'h-10 w-10 text-sm' }) {
  const initials = (user.name || user.email || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return user.avatar ? (
    <img src={img(user.avatar, 160, 1)} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span aria-hidden="true" className={`${size} flex shrink-0 items-center justify-center rounded-full bg-accent font-heading font-bold text-ink`}>{initials}</span>
  );
}

export const formatDateTime = (iso) =>
  iso ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—';

export const EVENT_LABELS = {
  login: ['Connexion', 'ok'],
  login_fail: ['Échec de connexion', 'bad'],
  login_disabled: ['Connexion refusée (compte désactivé)', 'bad'],
  logout: ['Déconnexion', ''],
  password_changed: ['Mot de passe modifié', 'ok'],
  password_reset: ['Mot de passe réinitialisé par un administrateur', 'warn'],
  recover: ['Mot de passe récupéré avec un code de secours', 'warn'],
  recover_fail: ['Échec de récupération (code de secours)', 'bad'],
  recovery_codes_generated: ['Nouveaux codes de secours', ''],
  profile_updated: ['Profil modifié', ''],
  email_changed: ['Adresse e-mail modifiée', 'warn'],
  session_closed: ['Session fermée', ''],
  sessions_closed: ['Sessions fermées', ''],
  user_created: ['Compte créé', 'ok'],
  user_updated: ['Compte modifié', ''],
  user_disabled: ['Compte désactivé', 'warn'],
  user_deleted: ['Compte supprimé', 'bad'],
};

const TONE = { ok: 'bg-green-100 text-green-800', bad: 'bg-red-100 text-red-800', warn: 'bg-amber-100 text-amber-900', '': 'bg-gray-100 text-gray-700' };

/** Tableau du journal des connexions et actions sur les comptes. */
export function LogTable({ entries, showAccount }) {
  if (!entries.length) return <p className="text-sm text-gray-500">Aucun évènement pour l’instant.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="text-xs uppercase text-gray-500">
          <tr>
            <th className="py-2 pr-3 font-semibold">Date</th>
            <th className="py-2 pr-3 font-semibold">Évènement</th>
            {showAccount && <th className="py-2 pr-3 font-semibold">Compte</th>}
            <th className="py-2 pr-3 font-semibold">Appareil</th>
            <th className="py-2 font-semibold">Adresse IP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((e, i) => {
            const [label, tone] = EVENT_LABELS[e.event] || [e.event, ''];
            return (
              <tr key={`${e.at}-${i}`}>
                <td className="whitespace-nowrap py-2 pr-3 text-gray-600">{formatDateTime(e.at)}</td>
                <td className="py-2 pr-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[tone]}`}>{label}</span>
                  {e.by && <span className="ml-2 text-xs text-gray-500">par {e.by}</span>}
                </td>
                {showAccount && <td className="py-2 pr-3">{e.email || '—'}</td>}
                <td className="py-2 pr-3 text-gray-600">{e.device}</td>
                <td className="py-2 font-mono text-xs text-gray-600">{e.ip}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Affiche un secret une seule fois (mot de passe provisoire, codes de secours) avec Copier. */
export function SecretReveal({ title, children, text, onClose, closeLabel = 'J’ai noté, fermer' }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers indisponible */
    }
  };
  return (
    <div role="alertdialog" aria-label={title} className="rounded-xl bg-amber-50 p-5 ring-1 ring-amber-300">
      <p className="font-semibold text-amber-950">{title}</p>
      <div className="mt-3">{children}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="btn-primary py-2">{copied ? 'Copié' : 'Copier'}</button>
        {onClose && <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-ink ring-1 ring-black/15 hover:bg-white">{closeLabel}</button>}
      </div>
    </div>
  );
}
