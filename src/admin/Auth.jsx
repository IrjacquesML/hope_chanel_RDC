import { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import { api } from './api';
import { NewPasswordFields, PasswordInput, newPasswordReady } from './accountUi';

const serverMessage = (ex) => (ex.status === undefined || ex.status >= 500 ? 'Serveur injoignable. Lancez « npm run dev ».' : ex.message);

function Shell({ title, intro, children, onSubmit }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-mist p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl ring-1 ring-black/5">
        <Logo />
        <h1 className="mt-6 text-xl font-bold">{title}</h1>
        {intro && <p className="mt-1 text-sm text-gray-600">{intro}</p>}
        {children}
      </form>
    </main>
  );
}

/** Mot de passe oublié : e-mail + code de secours + nouveau mot de passe. */
function Recover({ initialEmail, onDone, onBack }) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.recover({ email, code, password });
      onDone(email, r.recoveryCodesLeft);
    } catch (ex) {
      setError(serverMessage(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Mot de passe oublié" intro="Utilisez l’un de vos codes de secours (format ABCD-EFGH), créés dans « Mon compte »." onSubmit={submit}>
      <label htmlFor="rec-email" className="label mt-6">E-mail</label>
      <input id="rec-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />
      <label htmlFor="rec-code" className="label mt-4">Code de secours</label>
      <input id="rec-code" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} className="input font-mono uppercase tracking-wider" placeholder="ABCD-EFGH" required />
      <div className="mt-4 space-y-4">
        <NewPasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} email={email} />
      </div>
      {error && <p role="alert" className="error-text">{error}</p>}
      <button type="submit" disabled={busy || !email || !code || !newPasswordReady(password, confirm, email)} className="btn-primary mt-6 w-full py-3 disabled:opacity-60">
        {busy ? 'Vérification…' : 'Changer le mot de passe'}
      </button>
      <p className="mt-4 text-xs text-gray-600">Pas de code de secours ? Demandez à un administrateur de réinitialiser votre mot de passe.</p>
      <button type="button" onClick={onBack} className="mt-3 block w-full text-center text-sm text-gray-600 hover:text-brand">← Retour à la connexion</button>
    </Shell>
  );
}

export function Login({ onLogged }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  if (mode === 'recover') {
    return (
      <Recover
        initialEmail={email}
        onBack={() => setMode('login')}
        onDone={(mail, left) => {
          setEmail(mail);
          setPassword('');
          setInfo(`Mot de passe changé. Connectez-vous avec le nouveau. Il vous reste ${left} code(s) de secours.`);
          setMode('login');
        }}
      />
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.login(email, password);
      onLogged(r.user);
    } catch (ex) {
      setError(serverMessage(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Administration" onSubmit={submit}>
      {info && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800 ring-1 ring-green-200">{info}</p>}
      <label htmlFor="email" className="label mt-6">E-mail</label>
      <input id="email" type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
      <label htmlFor="pwd" className="label mt-4">Mot de passe</label>
      <input id="pwd" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" aria-invalid={!!error} aria-describedby={error ? 'pwd-err' : undefined} />
      {error && <p id="pwd-err" role="alert" className="error-text">{error}</p>}
      <button type="submit" disabled={busy || !email || !password} className="btn-primary mt-6 w-full py-3 disabled:opacity-60">{busy ? 'Connexion…' : 'Se connecter'}</button>
      <button type="button" onClick={() => setMode('recover')} className="mt-4 block w-full text-center text-sm font-semibold text-brand hover:underline">Mot de passe oublié ?</button>
      <Link to="/" className="mt-3 block text-center text-sm text-gray-600 hover:text-brand">← Retour au site</Link>
    </Shell>
  );
}

/** Premier accès avec un mot de passe provisoire : le nouveau mot de passe est obligatoire avant tout. */
export function ForcePasswordChange({ user, onDone, onLogout }) {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.changePassword(current, password);
      onDone(r.user);
    } catch (ex) {
      setError(serverMessage(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={`Bienvenue, ${user.name}`} intro="Pour sécuriser votre compte, remplacez le mot de passe provisoire par un mot de passe personnel." onSubmit={submit}>
      <div className="mt-6 space-y-4">
        <PasswordInput label="Mot de passe provisoire" value={current} onChange={setCurrent} required />
        <NewPasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} email={user.email} />
      </div>
      {error && <p role="alert" className="error-text">{error}</p>}
      <button type="submit" disabled={busy || !current || !newPasswordReady(password, confirm, user.email)} className="btn-primary mt-6 w-full py-3 disabled:opacity-60">
        {busy ? 'Enregistrement…' : 'Enregistrer mon mot de passe'}
      </button>
      <button type="button" onClick={onLogout} className="mt-4 block w-full text-center text-sm text-gray-600 hover:text-brand">Se déconnecter</button>
    </Shell>
  );
}
