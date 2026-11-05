import { useEffect, useState } from 'react';
import { api, imageToPng } from './api';

const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:bg-gray-100';

const KINDS = [
  ['full', 'Rapport complet', 'Synthèse, visites, visionnage et profil du public.'],
  ['views', 'Rapport de visionnage', 'Direct, épisodes et vidéos : lancements, temps regardé, heures d’écoute.'],
  ['visits', 'Rapport des visites', 'Fréquentation du site, pages consultées, provenance des visiteurs.'],
];

/* Dates au fuseau de Kinshasa (UTC+1), au format AAAA-MM-JJ */
const kinshasaToday = () => new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
const iso = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const addDays = (day, k) => new Date(Date.parse(day) + k * 86_400_000).toISOString().slice(0, 10);
function presets(today) {
  const [y, m] = today.split('-').map(Number);
  const q = Math.floor((m - 1) / 3);
  return [
    ['Mois en cours', iso(y, m - 1, 1), today],
    ['Mois précédent', iso(y, m - 2, 1), iso(y, m - 1, 0)],
    ['Trimestre précédent', iso(y, 3 * q - 3, 1), iso(y, 3 * q, 0)],
    ['Année en cours', iso(y, 0, 1), today],
  ];
}

/** Génère un rapport d'audience PDF sur l'intervalle choisi, signé par le directeur. */
export default function ReportPanel({ initialFrom, initialTo, user, logo, onClose }) {
  const today = kinshasaToday();
  const minDay = addDays(today, -399); // durée de conservation des statistiques
  const [kind, setKind] = useState('full');
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [config, setConfig] = useState(null);
  const [signer, setSigner] = useState({ name: '', title: 'Directeur', city: 'Kinshasa' });
  const [withSignature, setWithSignature] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    api.reportsConfig().then((c) => {
      setConfig(c);
      setSigner({ name: c.signerName, title: c.signerTitle, city: c.signerCity });
    }).catch((e) => setMsg({ type: 'error', text: e.message }));
  }, []);

  const rangeError = !from || !to ? 'Choisissez les deux dates.' : from > to ? 'La date de début doit précéder la date de fin.' : from < minDay ? 'Les statistiques ne sont conservées que 400 jours.' : '';
  const sameSigner = config && signer.name.trim() === config.signerName;
  const signerDirty = config && (signer.name.trim() !== config.signerName || signer.title.trim() !== config.signerTitle || signer.city.trim() !== config.signerCity);
  const set = (k) => (e) => setSigner((s) => ({ ...s, [k]: e.target.value }));

  const generate = async () => {
    setBusy('pdf');
    setMsg(null);
    try {
      // Le logo est converti en PNG par le navigateur (le PDF n'accepte pas le WebP).
      const logoPng = logo ? await imageToPng(logo, 900).catch(() => null) : null;
      const { blob, name } = await api.reportPdf({ kind, from, to, signer, withSignature, logo: logoPng });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setMsg({ type: 'ok', text: `Rapport téléchargé : ${name}` });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setBusy('');
    }
  };

  const saveConfig = async (signature) => {
    setBusy('save');
    setMsg(null);
    try {
      const body = { signerName: signer.name, signerTitle: signer.title, signerCity: signer.city };
      if (signature !== undefined) body.signature = signature;
      await api.saveReportsConfig(body);
      const c = await api.reportsConfig();
      setConfig(c);
      setSigner({ name: c.signerName, title: c.signerTitle, city: c.signerCity });
      setMsg({ type: 'ok', text: signature === null ? 'Signature retirée.' : 'Signataire enregistré : il sera proposé pour les prochains rapports.' });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setBusy('');
    }
  };

  const onSignatureFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await saveConfig(await imageToPng(file, 800));
    } catch (ex) {
      setMsg({ type: 'error', text: ex.message });
    }
  };

  return (
    <section aria-labelledby="report-title" className="rounded-xl bg-white p-5 ring-2 ring-brand/30">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 id="report-title" className="font-semibold">Générer un rapport PDF</h2>
          <p className="text-xs text-gray-500">Document à en-tête Hope Channel RDC (logo et coordonnées), numéroté, avec le bloc de signature du directeur.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-sm text-gray-600 hover:bg-mist">Fermer ✕</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Type de rapport</legend>
            <div className="space-y-2">
              {KINDS.map(([k, label, hint]) => (
                <label key={k} className={`flex cursor-pointer gap-3 rounded-lg p-3 ring-1 ${kind === k ? 'bg-brand/5 ring-brand' : 'ring-gray-200 hover:bg-mist'}`}>
                  <input type="radio" name="report-kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="mt-1" />
                  <span>
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="block text-xs text-gray-600">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Intervalle du rapport</legend>
            <div className="mb-3 flex flex-wrap gap-2">
              {presets(today).map(([label, f, t]) => (
                <button key={label} type="button" onClick={() => { setFrom(f < minDay ? minDay : f); setTo(t); }} className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${from === f && to === t ? 'bg-brand text-white ring-brand' : 'text-brand ring-black/10 hover:bg-mist'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-gray-700">Du</span>
                <input type="date" value={from} min={minDay} max={today} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-700">Au</span>
                <input type="date" value={to} min={minDay} max={today} onChange={(e) => setTo(e.target.value)} className={inputCls} />
              </label>
            </div>
            {rangeError && <p className="mt-1 text-xs font-medium text-red-700">{rangeError}</p>}
          </fieldset>
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-medium">Signataire</legend>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-700">Nom complet</span>
            <input value={signer.name} onChange={set('name')} maxLength={120} placeholder="Ex. : Pasteur Jean Mukendi" className={inputCls} disabled={!config} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block text-gray-700">Fonction</span>
              <input value={signer.title} onChange={set('title')} maxLength={120} placeholder="Directeur" className={inputCls} disabled={!config} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-700">Fait à</span>
              <input value={signer.city} onChange={set('city')} maxLength={80} placeholder="Kinshasa" className={inputCls} disabled={!config} />
            </label>
          </div>

          {config?.hasSignature && (
            <label className={`flex items-center gap-2 text-sm ${sameSigner ? '' : 'text-gray-400'}`}>
              <input type="checkbox" checked={withSignature && sameSigner} disabled={!sameSigner} onChange={(e) => setWithSignature(e.target.checked)} />
              Apposer la signature scannée
              {!sameSigner && <span className="text-xs">(réservée à {config.signerName || 'au signataire enregistré'})</span>}
            </label>
          )}
          {!isAdmin && (
            <p className="text-xs text-gray-500">Le nom et la fonction peuvent être modifiés pour ce rapport. Seul un administrateur peut changer le signataire par défaut.</p>
          )}

          {isAdmin && config && (
            <div className="space-y-3 rounded-lg bg-mist p-3">
              <p className="text-xs text-gray-600">Administrateur : enregistrez le directeur comme signataire par défaut et, si vous le souhaitez, sa signature scannée (PNG sur fond blanc ou transparent). Elle reste privée : elle n’est jamais publiée sur le site.</p>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => saveConfig()} disabled={!signerDirty || !signer.name.trim() || busy} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand ring-1 ring-black/10 hover:bg-gray-50 disabled:opacity-50">
                  {busy === 'save' ? 'Enregistrement…' : 'Enregistrer comme signataire par défaut'}
                </button>
                <label className="inline-flex cursor-pointer items-center rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand ring-1 ring-black/10 hover:bg-gray-50">
                  {config.hasSignature ? 'Remplacer la signature' : '⬆ Ajouter une signature scannée'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onSignatureFile} disabled={Boolean(busy)} />
                </label>
                {config.hasSignature && (
                  <button type="button" onClick={() => window.confirm('Retirer la signature scannée ?') && saveConfig(null)} className="text-xs font-semibold text-red-700 hover:underline">Retirer</button>
                )}
              </div>
              {config.signature && <img src={config.signature} alt="Signature enregistrée" className="h-16 rounded bg-white p-1 ring-1 ring-black/10" />}
            </div>
          )}
        </fieldset>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-gray-100 pt-4">
        <button type="button" onClick={generate} disabled={Boolean(rangeError) || !config || Boolean(busy)} className="btn-primary disabled:opacity-50">
          {busy === 'pdf' ? 'Génération…' : '⬇ Télécharger le rapport PDF'}
        </button>
        {msg && <p role={msg.type === 'error' ? 'alert' : 'status'} className={`text-sm ${msg.type === 'error' ? 'text-red-700' : 'text-green-700'}`}>{msg.text}</p>}
      </div>
    </section>
  );
}
