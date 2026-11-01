import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { Field } from './fields';
import { ROLE_INFO, ROLE_LABELS } from './permissions';
import { Avatar, LogTable, NewPasswordFields, PasswordInput, SecretReveal, formatDateTime, newPasswordReady } from './accountUi';

function Card({ title, subtitle, children }) {
  return (
    <section className="rounded-xl bg-white p-6 ring-1 ring-black/5">
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Profile({ user, onSaved, notify }) {
  const [form, setForm] = useState({ name: user.name, email: user.email, avatar: user.avatar, current: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const emailChanged = form.email.trim().toLowerCase() !== user.email;
  const dirty = form.name !== user.name || emailChanged || form.avatar !== user.avatar;
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.saveProfile(form);
      onSaved(r.user);
      setForm((f) => ({ ...f, current: '' }));
      notify('Profil enregistré.');
    } catch (ex) {
      setError(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field def={{ name: 'name', label: 'Nom affiché', required: true }} value={form.name} onChange={set('name')} />
      <Field def={{ name: 'email', label: 'E-mail de connexion', type: 'email', required: true }} value={form.email} onChange={set('email')} />
      <Field def={{ name: 'avatar', label: 'Photo de profil (carrée)', type: 'image' }} value={form.avatar} onChange={set('avatar')} />
      {emailChanged && (
        <div className="sm:col-span-2">
          <PasswordInput label="Mot de passe actuel (requis pour changer d’e-mail)" value={form.current} onChange={set('current')} required />
        </div>
      )}
      {error && <p role="alert" className="error-text sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={!dirty || busy || (emailChanged && !form.current)} className="btn-primary disabled:opacity-50">{busy ? 'Enregistrement…' : 'Enregistrer le profil'}</button>
      </div>
    </form>
  );
}

function PasswordChange({ user, onSaved, notify }) {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.changePassword(current, password);
      onSaved(r.user);
      setCurrent('');
      setPassword('');
      setConfirm('');
      notify('Mot de passe modifié. Vos autres sessions ont été fermées.');
    } catch (ex) {
      setError(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
      <PasswordInput label="Mot de passe actuel" value={current} onChange={setCurrent} required />
      <NewPasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} email={user.email} />
      {error && <p role="alert" className="error-text sm:col-span-3">{error}</p>}
      <div className="sm:col-span-3">
        <button type="submit" disabled={busy || !current || !newPasswordReady(password, confirm, user.email)} className="btn-primary disabled:opacity-50">{busy ? 'Enregistrement…' : 'Changer le mot de passe'}</button>
      </div>
    </form>
  );
}

function RecoveryCodes({ user, onGenerated }) {
  const [asking, setAsking] = useState(false);
  const [current, setCurrent] = useState('');
  const [codes, setCodes] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const generate = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.recoveryCodes(current);
      setCodes(r.codes);
      setAsking(false);
      setCurrent('');
      onGenerated(r.codes.length);
    } catch (ex) {
      setError(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const text = codes && `Codes de secours — administration Hope Chanel RDC\nCompte : ${user.email}\nCréés le : ${formatDateTime(new Date().toISOString())}\n\n${codes.join('\n')}\n\nChaque code ne sert qu’une fois. Conservez-les en lieu sûr.\n`;
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'codes-de-secours-hope-chanel-rdc.txt' });
    a.click();
    URL.revokeObjectURL(url);
  };

  if (codes) {
    return (
      <SecretReveal title="Vos nouveaux codes de secours : ils ne seront plus jamais affichés" text={text} onClose={() => setCodes(null)}>
        <ol className="grid grid-cols-2 gap-2 font-mono text-base sm:grid-cols-4">
          {codes.map((c) => <li key={c} className="rounded-lg bg-white px-3 py-2 text-center tracking-wider ring-1 ring-amber-200">{c}</li>)}
        </ol>
        <p className="mt-3 text-sm text-amber-950">Chaque code ne sert qu’une fois. Rangez-les hors de l’ordinateur (papier, coffre, gestionnaire de mots de passe). Les anciens codes ne fonctionnent plus.</p>
        <button type="button" onClick={download} className="mt-3 text-sm font-semibold text-brand hover:underline">⬇ Télécharger en fichier texte</button>
      </SecretReveal>
    );
  }

  return (
    <div>
      <p className={`rounded-lg p-3 text-sm ring-1 ${user.recoveryCodesLeft ? 'bg-green-50 text-green-900 ring-green-200' : 'bg-amber-50 text-amber-950 ring-amber-200'}`}>
        {user.recoveryCodesLeft
          ? `Il vous reste ${user.recoveryCodesLeft} code(s) de secours sur 8.`
          : 'Vous n’avez aucun code de secours : en cas d’oubli du mot de passe, seul un autre administrateur pourra vous dépanner.'}
      </p>
      {asking ? (
        <form onSubmit={generate} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <PasswordInput label="Confirmez avec votre mot de passe actuel" value={current} onChange={setCurrent} required />
          </div>
          <button type="submit" disabled={busy || !current} className="btn-primary disabled:opacity-50">{busy ? 'Création…' : 'Créer les codes'}</button>
          <button type="button" onClick={() => setAsking(false)} className="text-sm text-gray-600 hover:text-ink">Annuler</button>
          {error && <p role="alert" className="error-text w-full">{error}</p>}
        </form>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className="btn-outline mt-4">{user.recoveryCodesLeft ? 'Remplacer mes codes de secours' : 'Créer mes codes de secours'}</button>
      )}
    </div>
  );
}

function Sessions({ sessions, onChange, notify }) {
  const close = async (id) => {
    try {
      await api.closeSession(id);
      notify('Session fermée.');
      onChange();
    } catch (ex) {
      notify(ex.message, 'error');
    }
  };
  const closeOthers = async () => {
    try {
      const r = await api.closeOtherSessions();
      notify(`${r.closed} session(s) fermée(s).`);
      onChange();
    } catch (ex) {
      notify(ex.message, 'error');
    }
  };
  const others = sessions.filter((s) => !s.current).length;
  return (
    <div>
      <ul className="divide-y divide-gray-100">
        {sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {s.device} {s.current && <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Cette session</span>}
              </p>
              <p className="text-xs text-gray-500">Ouverte le {formatDateTime(s.createdAt)} · active le {formatDateTime(s.lastSeen)} · IP {s.ip}</p>
            </div>
            {!s.current && <button type="button" onClick={() => close(s.id)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50">Fermer</button>}
          </li>
        ))}
      </ul>
      {others > 0 && <button type="button" onClick={closeOthers} className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50">Fermer les {others} autre(s) session(s)</button>}
      <p className="mt-3 text-xs text-gray-500">Une session dure 8 heures. Fermez celles que vous ne reconnaissez pas, puis changez votre mot de passe.</p>
    </div>
  );
}

export default function Account({ user, onUserChange, notify, onAuthLost }) {
  const [info, setInfo] = useState(null);
  const load = useCallback(
    () =>
      api
        .account()
        .then(setInfo)
        .catch((e) => (e.status === 401 ? onAuthLost() : notify(e.message, 'error'))),
    [notify, onAuthLost],
  );
  useEffect(() => {
    load();
  }, [load]);

  const saved = (u) => {
    onUserChange(u);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar user={user} size="h-16 w-16 text-xl" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">Mon compte</h1>
          <p className="text-sm text-gray-600">
            {user.name} · {user.email} · <span className="font-semibold text-brand">{ROLE_LABELS[user.role]}</span>
          </p>
          <p className="mt-0.5 text-xs text-gray-500">{ROLE_INFO[user.role]}</p>
        </div>
        <dl className="text-xs text-gray-600">
          <div><dt className="inline">Dernière connexion : </dt><dd className="inline font-medium">{formatDateTime(user.lastLoginAt)}</dd></div>
          <div><dt className="inline">Mot de passe changé le : </dt><dd className="inline font-medium">{formatDateTime(user.passwordChangedAt)}</dd></div>
        </dl>
      </div>

      <Card title="Profil">
        <Profile key={`${user.name}|${user.email}|${user.avatar}`} user={user} onSaved={saved} notify={notify} />
      </Card>
      <Card title="Mot de passe" subtitle="Changer de mot de passe ferme vos sessions ouvertes sur les autres appareils.">
        <PasswordChange user={user} onSaved={saved} notify={notify} />
      </Card>
      <Card title="Codes de secours" subtitle="En cas d’oubli du mot de passe, un code de secours permet d’en choisir un nouveau depuis la page de connexion (« Mot de passe oublié ? »).">
        <RecoveryCodes user={user} onGenerated={(n) => onUserChange({ ...user, recoveryCodesLeft: n })} />
      </Card>
      <Card title="Sessions ouvertes">{info ? <Sessions sessions={info.sessions} onChange={load} notify={notify} /> : <p className="text-sm text-gray-500">Chargement…</p>}</Card>
      <Card title="Historique de mon compte" subtitle="30 derniers évènements : connexions, échecs, changements de mot de passe…">
        {info ? <LogTable entries={info.history} /> : <p className="text-sm text-gray-500">Chargement…</p>}
      </Card>
    </div>
  );
}
