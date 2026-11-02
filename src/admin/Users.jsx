import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { Field } from './fields';
import { ROLE_INFO, ROLE_LABELS } from './permissions';
import { Avatar, LogTable, SecretReveal, formatDateTime } from './accountUi';

const ROLE_BADGE = { admin: 'bg-brand text-white', editor: 'bg-sky-100 text-sky-900', technician: 'bg-violet-100 text-violet-900' };

function UserForm({ initial, isSelf, onCancel, onSubmit }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const isNew = !initial.id;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit(form);
    } catch (ex) {
      setError(ex.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl bg-white p-6 ring-2 ring-brand/30">
      <h2 className="font-semibold">{isNew ? 'Nouveau compte' : `Modifier : ${initial.name}`}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field def={{ name: 'name', label: 'Nom', required: true, placeholder: 'Ex. : Marie Kabila' }} value={form.name} onChange={set('name')} />
        <Field def={{ name: 'email', label: 'E-mail de connexion', type: 'email', required: true }} value={form.email} onChange={set('email')} />
      </div>
      <fieldset className="mt-5" disabled={isSelf}>
        <legend className="mb-2 text-sm font-medium">Rôle {isSelf && <span className="font-normal text-gray-500">(vous ne pouvez pas changer votre propre rôle)</span>}</legend>
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(ROLE_LABELS).map(([key, label]) => (
            <label key={key} className={`flex cursor-pointer gap-3 rounded-xl p-4 ring-1 transition ${form.role === key ? 'bg-brand/5 ring-2 ring-brand' : 'ring-black/10 hover:ring-brand/40'} ${isSelf ? 'cursor-not-allowed opacity-60' : ''}`}>
              <input type="radio" name="role" value={key} checked={form.role === key} onChange={() => set('role')(key)} className="mt-1 h-4 w-4 accent-brand" />
              <span>
                <span className="block font-semibold">{label}</span>
                <span className="text-xs text-gray-600">{ROLE_INFO[key]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {!isNew && !isSelf && (
        <label className="mt-4 flex items-center gap-3 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => set('active')(e.target.checked)} className="h-4 w-4 accent-brand" />
          Compte actif <span className="text-gray-500">(un compte désactivé ne peut plus se connecter ; ses sessions sont fermées)</span>
        </label>
      )}
      {isNew && <p className="mt-4 text-sm text-gray-600">Un <strong>mot de passe provisoire</strong> sera créé et affiché une seule fois. La personne devra le remplacer à sa première connexion.</p>}
      {error && <p role="alert" className="error-text">{error}</p>}
      <div className="mt-5 flex gap-3">
        <button type="submit" disabled={busy || !form.name.trim() || !form.email.trim()} className="btn-primary disabled:opacity-50">{busy ? 'Enregistrement…' : isNew ? 'Créer le compte' : 'Enregistrer'}</button>
        <button type="button" onClick={onCancel} className="rounded-full px-4 text-sm font-semibold text-gray-700 hover:bg-mist">Annuler</button>
      </div>
    </form>
  );
}

function Confirm({ text, label = 'Confirmer', onYes, onNo, danger }) {
  return (
    <span className="flex flex-wrap items-center gap-2 rounded-lg bg-mist px-3 py-2 text-sm">
      {text}
      <button type="button" onClick={onYes} className={`rounded-lg px-3 py-1 font-semibold text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand hover:bg-brand-dark'}`}>{label}</button>
      <button type="button" onClick={onNo} className="rounded-lg px-2 py-1 text-gray-600 hover:bg-gray-200">Annuler</button>
    </span>
  );
}

export default function Users({ me, notify, onAuthLost }) {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null); // null | objet compte (sans id = nouveau)
  const [reveal, setReveal] = useState(null);
  const [confirm, setConfirm] = useState(null); // { id, action }
  const [logFilter, setLogFilter] = useState('');

  const load = useCallback(
    () =>
      api
        .users()
        .then(setData)
        .catch((e) => (e.status === 401 ? onAuthLost() : notify(e.message, 'error'))),
    [notify, onAuthLost],
  );
  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn, message) => {
    setConfirm(null);
    try {
      const r = await fn();
      if (message) notify(message);
      await load();
      return r;
    } catch (ex) {
      notify(ex.message, 'error');
    }
  };

  const save = async (form) => {
    if (form.id) {
      await api.updateUser(form.id, form);
      notify('Compte enregistré.');
    } else {
      const r = await api.createUser(form);
      setReveal({ title: `Compte créé pour ${r.user.name}`, email: r.user.email, password: r.tempPassword });
    }
    setEditing(null);
    load();
  };

  const resetPassword = async (u) => {
    const r = await act(() => api.resetUserPassword(u.id));
    if (r) setReveal({ title: `Nouveau mot de passe provisoire pour ${u.name}`, email: u.email, password: r.tempPassword });
  };

  if (!data) return <p className="text-sm text-gray-500">Chargement…</p>;
  const admins = data.users.filter((u) => u.role === 'admin' && u.active).length;
  const log = logFilter ? data.log.filter((e) => e.userId === logFilter) : data.log;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Comptes</h1>
          <p className="mt-1 text-sm text-gray-600">Personnes ayant accès à l’administration, leur rôle et leurs mots de passe.</p>
        </div>
        {!editing && <button type="button" onClick={() => setEditing({ name: '', email: '', role: 'editor', active: true })} className="btn-primary">+ Nouveau compte</button>}
      </div>

      {reveal && (
        <SecretReveal title={reveal.title} text={`Administration Hope Channel RDC\nAdresse : ${location.origin}/login\nE-mail : ${reveal.email}\nMot de passe provisoire : ${reveal.password}`} onClose={() => setReveal(null)}>
          <dl className="grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
            <dt className="text-amber-900">Adresse</dt><dd className="font-medium">{location.origin}/login</dd>
            <dt className="text-amber-900">E-mail</dt><dd className="font-medium">{reveal.email}</dd>
            <dt className="text-amber-900">Mot de passe provisoire</dt><dd className="font-mono text-lg font-bold tracking-wider">{reveal.password}</dd>
          </dl>
          <p className="mt-3 text-sm text-amber-950">Transmettez-le de façon privée (en main propre, appel, message direct). Il ne sera plus affiché ; la personne devra le changer à sa première connexion.</p>
        </SecretReveal>
      )}

      {editing && <UserForm key={editing.id || 'new'} initial={editing} isSelf={editing.id === me.id} onCancel={() => setEditing(null)} onSubmit={save} />}

      <section className="rounded-xl bg-white ring-1 ring-black/5">
        <ul className="divide-y divide-gray-100">
          {data.users.map((u) => {
            const self = u.id === me.id;
            const lastAdmin = u.role === 'admin' && u.active && admins === 1;
            const asking = confirm?.id === u.id && confirm.action;
            return (
              <li key={u.id} className={`flex flex-wrap items-center gap-4 p-4 ${u.active ? '' : 'bg-gray-50'}`}>
                <Avatar user={u} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    <span className={u.active ? '' : 'text-gray-500 line-through'}>{u.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_BADGE[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                    {self && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-ink">Vous</span>}
                    {!u.active && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">Désactivé</span>}
                    {u.active && u.mustChangePassword && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Mot de passe provisoire</span>}
                  </p>
                  <p className="truncate text-sm text-gray-600">{u.email}</p>
                  <p className="text-xs text-gray-500">
                    Dernière connexion : {formatDateTime(u.lastLoginAt)} · {u.sessions} session(s) ouverte(s) · {u.recoveryCodesLeft ? `${u.recoveryCodesLeft} code(s) de secours` : 'aucun code de secours'}
                  </p>
                </div>
                {asking === 'reset' ? (
                  <Confirm text="Créer un mot de passe provisoire ?" onYes={() => resetPassword(u)} onNo={() => setConfirm(null)} />
                ) : asking === 'delete' ? (
                  <Confirm text={`Supprimer définitivement ${u.name} ?`} label="Supprimer" danger onYes={() => act(() => api.deleteUser(u.id), 'Compte supprimé.')} onNo={() => setConfirm(null)} />
                ) : (
                  <div className="flex flex-wrap gap-1 text-sm">
                    <button type="button" onClick={() => setEditing({ ...u })} className="rounded-lg px-3 py-1.5 font-semibold text-brand hover:bg-brand/10">Modifier</button>
                    {!self && (
                      <>
                        <button type="button" onClick={() => setConfirm({ id: u.id, action: 'reset' })} className="rounded-lg px-3 py-1.5 font-semibold text-brand hover:bg-brand/10">Réinitialiser le mot de passe</button>
                        {u.sessions > 0 && <button type="button" onClick={() => act(() => api.closeUserSessions(u.id), 'Sessions fermées.')} className="rounded-lg px-3 py-1.5 font-semibold text-brand hover:bg-brand/10">Déconnecter</button>}
                        {!lastAdmin && (
                          <button type="button" onClick={() => act(() => api.updateUser(u.id, { ...u, active: !u.active }), u.active ? 'Compte désactivé.' : 'Compte réactivé.')} className="rounded-lg px-3 py-1.5 font-semibold text-gray-700 hover:bg-mist">
                            {u.active ? 'Désactiver' : 'Réactiver'}
                          </button>
                        )}
                        {!lastAdmin && <button type="button" onClick={() => setConfirm({ id: u.id, action: 'delete' })} className="rounded-lg px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50">Supprimer</button>}
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <p className="text-xs text-gray-500">Pour votre propre compte (mot de passe, codes de secours, sessions), utilisez « Mon compte ». Il doit toujours rester au moins un administrateur actif.</p>

      <section className="rounded-xl bg-white p-6 ring-1 ring-black/5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Journal des connexions</h2>
            <p className="text-sm text-gray-600">Connexions, échecs, changements de mot de passe et actions sur les comptes (500 derniers évènements).</p>
          </div>
          <select value={logFilter} onChange={(e) => setLogFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" aria-label="Filtrer par compte">
            <option value="">Tous les comptes</option>
            {data.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <LogTable entries={log.slice(0, 100)} showAccount />
      </section>
    </div>
  );
}
