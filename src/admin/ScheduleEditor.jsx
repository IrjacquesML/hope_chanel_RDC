import { useState } from 'react';
import { slugify } from './fields';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const TEMPLATE_LABELS = { weekday: 'Lun.–ven.', saturday: 'Samedi', sunday: 'Dimanche' };
const cell = 'h-10 rounded-md border border-gray-300 bg-white px-2 text-sm focus:border-brand focus:outline-none';
// Colonnes de la vue « ligne » (grand écran)
const ROW = 'xl:grid-cols-[7.5rem_7.5rem_minmax(10rem,1fr)_minmax(14rem,1.4fr)_4.5rem_3.5rem]';

/** Vérifie horaires et chevauchements d'un modèle de journée. */
function checkSlots(slots) {
  const issues = [];
  const sorted = [...slots].sort((a, b) => a.start.localeCompare(b.start));
  sorted.forEach((s, i) => {
    if (!s.start || !s.end) issues.push('Un créneau n’a pas d’horaire.');
    else if (s.start >= s.end) issues.push(`${s.start} : l’heure de fin doit être après l’heure de début.`);
    if (!s.show && !s.title?.fr) issues.push(`${s.start || '?'} : choisissez une émission ou saisissez un titre.`);
    const next = sorted[i + 1];
    if (next && s.end > next.start) issues.push(`${s.start}–${s.end} chevauche ${next.start}.`);
  });
  return issues;
}

export default function ScheduleEditor({ schedule, shows, onSave, onGo }) {
  const [draft, setDraft] = useState(schedule);
  const [tab, setTab] = useState(Object.keys(schedule.templates)[0]);
  // Création d'un modèle de journée : null = formulaire fermé
  const [creating, setCreating] = useState(null);
  const [focusSlot, setFocusSlot] = useState(-1);
  const dirty = JSON.stringify(draft) !== JSON.stringify(schedule);
  const slots = draft.templates[tab] || [];
  const issues = checkSlots(slots);
  const allIssues = Object.values(draft.templates).flatMap(checkSlots);
  /** Nom affiché d'un modèle (avec ses accents) : « Lun.–ven. », « Fête de Noël »… */
  const label = (k) => draft.labels?.[k] || TEMPLATE_LABELS[k] || k;
  const newKey = creating ? slugify(creating.name) : '';
  const nameError = creating?.name.trim() && (!newKey ? 'Utilisez au moins une lettre ou un chiffre.' : draft.templates[newKey] ? 'Un modèle porte déjà ce nom.' : '');

  const setSlots = (next) => setDraft((d) => ({ ...d, templates: { ...d.templates, [tab]: next } }));
  const updateSlot = (i, patch) => setSlots(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const addSlot = () => {
    const last = [...slots].sort((a, b) => a.start.localeCompare(b.start)).at(-1);
    const start = last?.end && last.end !== '23:59' ? last.end : '06:00';
    const [h, m] = start.split(':').map(Number);
    const end = h >= 23 ? '23:59' : `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    // Sans émission enregistrée, le créneau commence en « titre libre » et le curseur va dans le titre
    setSlots([...slots, shows.length ? { start, end, show: shows[0].slug } : { start, end, title: { fr: '', en: '' } }]);
    setFocusSlot(slots.length);
  };

  const addTemplate = (e) => {
    e.preventDefault();
    if (!newKey || nameError) return;
    const copy = creating.from ? structuredClone(draft.templates[creating.from]) : [];
    setDraft((d) => ({ ...d, templates: { ...d.templates, [newKey]: copy }, labels: { ...d.labels, [newKey]: creating.name.trim() } }));
    setTab(newKey);
    setCreating(null);
  };

  const removeTemplate = (key) => {
    if (draft.week.includes(key)) return;
    setDraft((d) => {
      const { [key]: _, ...rest } = d.templates;
      const { [key]: __, ...labels } = d.labels || {};
      return { ...d, templates: rest, labels };
    });
    setTab('weekday' in draft.templates ? 'weekday' : Object.keys(draft.templates)[0]);
  };

  const save = async () => {
    const sortedTemplates = Object.fromEntries(
      Object.entries(draft.templates).map(([k, v]) => [k, [...v].sort((a, b) => a.start.localeCompare(b.start))]),
    );
    const next = { ...draft, templates: sortedTemplates };
    if (await onSave(next)) setDraft(next);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Programme</h1>
          <p className="mt-1 text-sm text-gray-600">Grille horaire en heure de Kinshasa (UTC+1). Chaque jour utilise un modèle de journée.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            {dirty && <button type="button" onClick={() => setDraft(schedule)} className="rounded-full px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200">Annuler les modifications</button>}
            <button type="button" onClick={save} disabled={!dirty || allIssues.length > 0} className="btn-primary disabled:opacity-50">Enregistrer le programme</button>
          </div>
          {/* Explique pourquoi le bouton est grisé */}
          <p className="text-xs text-gray-500">
            {allIssues.length > 0 ? <span className="font-medium text-red-700">Corrigez les erreurs signalées en rouge pour pouvoir enregistrer.</span> : !dirty && 'Aucune modification à enregistrer.'}
          </p>
        </div>
      </div>

      {shows.length === 0 && (
        <div className="mb-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <p>
            <strong>Aucune émission n’est encore enregistrée.</strong> Vous pouvez remplir la grille avec des <strong>titres libres</strong> (ex. « Culte du matin »), ou créer d’abord vos émissions pour les choisir dans la liste.
          </p>
          {onGo && <button type="button" onClick={() => onGo('shows')} className="mt-2 font-semibold text-brand hover:underline">Créer une émission →</button>}
        </div>
      )}

      <ol className="mb-6 grid gap-2 text-sm text-gray-700 sm:grid-cols-3">
        {[
          ['Les modèles de journée', 'Une grille d’horaires réutilisable : « Lun.–ven. », « Samedi », « Dimanche », ou un modèle à vous (fête, campagne…).'],
          ['La semaine type', 'Choisissez quel modèle utilise chaque jour de la semaine.'],
          ['Enregistrer', 'Le programme du site (page Programme et « En ce moment ») est mis à jour aussitôt.'],
        ].map(([title, text], i) => (
          <li key={title} className="flex gap-3 rounded-xl bg-white p-3 ring-1 ring-black/5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
            <span><strong className="block text-ink">{title}</strong>{text}</span>
          </li>
        ))}
      </ol>

      <section className="mb-8 rounded-xl bg-white p-5 ring-1 ring-black/5">
        <h2 className="mb-3 font-semibold">Semaine type</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 2xl:grid-cols-7">
          {DAYS.map((d, i) => (
            <label key={d} className="min-w-0 text-sm">
              <span className="mb-1 block font-medium">{d}</span>
              <select value={draft.week[i]} onChange={(e) => setDraft((s) => ({ ...s, week: s.week.map((w, j) => (j === i ? e.target.value : w)) }))} className={`${cell} w-full`}>
                {Object.keys(draft.templates).map((k) => <option key={k} value={k}>{label(k)}</option>)}
              </select>
            </label>
          ))}
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {Object.keys(draft.templates).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            aria-pressed={tab === k}
            className={`min-h-[44px] rounded-full px-4 text-sm font-semibold ${tab === k ? 'bg-brand text-white' : 'bg-white text-gray-700 ring-1 ring-black/10 hover:bg-mist'}`}
          >
            {label(k)} <span className="opacity-70">({draft.templates[k].length})</span>
          </button>
        ))}
        {!creating && (
          <button type="button" onClick={() => setCreating({ name: '', from: '' })} className="min-h-[44px] rounded-full px-4 text-sm font-semibold text-brand ring-1 ring-brand/30 hover:bg-brand/10">
            + Nouveau modèle de journée
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={addTemplate} className="mb-4 rounded-xl bg-white p-4 ring-2 ring-brand/30">
          <p className="mb-3 font-semibold">Nouveau modèle de journée</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Nom du modèle</span>
              <input autoFocus value={creating.name} onChange={(e) => setCreating((c) => ({ ...c, name: e.target.value }))} placeholder="Ex. : Fête de Noël, Campagne d’évangélisation" className={`${cell} w-full`} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Partir de</span>
              <select value={creating.from} onChange={(e) => setCreating((c) => ({ ...c, from: e.target.value }))} className={`${cell} w-full`}>
                <option value="">Une grille vide</option>
                {Object.keys(draft.templates).map((k) => <option key={k} value={k}>Une copie de « {label(k)} » ({draft.templates[k].length} créneau{draft.templates[k].length > 1 ? 'x' : ''})</option>)}
              </select>
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={!newKey || Boolean(nameError)} className="btn-primary py-2 disabled:opacity-50">Créer le modèle</button>
              <button type="button" onClick={() => setCreating(null)} className="rounded-full px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200">Annuler</button>
            </div>
          </div>
          {nameError ? <p className="mt-2 text-sm text-red-700">{nameError}</p> : <p className="mt-2 text-xs text-gray-500">Pour l’utiliser, choisissez-le ensuite pour un ou plusieurs jours dans « Semaine type », puis enregistrez.</p>}
        </form>
      )}

      {/* Grand écran : une ligne par créneau. Mobile / tablette : une carte par créneau. */}
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
        <div className={`hidden gap-3 bg-mist px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 xl:grid ${ROW}`} aria-hidden="true">
          <span>Début</span><span>Fin</span><span>Émission</span><span>Titre libre (si pas d’émission)</span><span className="text-center">Direct</span><span />
        </div>
        <ul className="divide-y divide-gray-100">
          {slots.length === 0 && <li className="p-6 text-center text-sm text-gray-500">Aucun créneau dans « {label(tab)} » : cliquez sur « + Ajouter un créneau ».</li>}
          {slots.map((s, i) => (
            <li key={i} className={`grid grid-cols-2 gap-3 p-4 xl:items-center xl:gap-3 xl:px-3 xl:py-2 ${ROW}`}>
              <label className="text-xs font-medium text-gray-600 xl:contents">
                <span className="mb-1 block xl:hidden">Début</span>
                <input type="time" value={s.start} onChange={(e) => updateSlot(i, { start: e.target.value })} className={`${cell} w-full`} aria-label="Début" />
              </label>
              <label className="text-xs font-medium text-gray-600 xl:contents">
                <span className="mb-1 block xl:hidden">Fin</span>
                <input type="time" value={s.end} onChange={(e) => updateSlot(i, { end: e.target.value })} className={`${cell} w-full`} aria-label="Fin" />
              </label>
              <label className="col-span-2 text-xs font-medium text-gray-600 xl:col-span-1 xl:contents">
                <span className="mb-1 block xl:hidden">Émission</span>
                <select
                  value={s.show || ''}
                  onChange={(e) => updateSlot(i, e.target.value ? { show: e.target.value, title: undefined } : { show: undefined, title: s.title || { fr: '', en: '' } })}
                  className={`${cell} w-full min-w-0`}
                  aria-label="Émission"
                >
                  <option value="">— Titre libre —</option>
                  {shows.map((sh) => <option key={sh.slug} value={sh.slug}>{sh.title}</option>)}
                </select>
              </label>
              <div className={`col-span-2 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 xl:col-span-1 ${s.show ? 'hidden xl:block' : ''}`}>
                {!s.show && (
                  <>
                    <input autoFocus={i === focusSlot} value={s.title?.fr || ''} onChange={(e) => updateSlot(i, { title: { ...s.title, fr: e.target.value } })} placeholder="Titre FR" aria-label="Titre FR" className={`${cell} w-full min-w-0`} />
                    <input value={s.title?.en || ''} onChange={(e) => updateSlot(i, { title: { ...s.title, en: e.target.value } })} placeholder="Titre EN" aria-label="Titre EN" className={`${cell} w-full min-w-0`} />
                  </>
                )}
              </div>
              <label className="flex min-h-[44px] items-center gap-2 text-sm xl:justify-center">
                <input type="checkbox" checked={!!s.live} onChange={(e) => updateSlot(i, { live: e.target.checked || undefined })} className="h-5 w-5 accent-red-600" aria-label="En direct" />
                <span className="xl:sr-only">En direct</span>
              </label>
              <div className="flex justify-end">
                <button type="button" onClick={() => setSlots(slots.filter((_, j) => j !== i))} className="flex h-11 min-w-[44px] items-center justify-center gap-1 rounded-lg px-3 text-sm text-red-700 hover:bg-red-50" aria-label="Supprimer le créneau">
                  ✕<span className="xl:hidden">Supprimer</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={addSlot} className="min-h-[44px] rounded-full bg-brand/10 px-4 text-sm font-semibold text-brand hover:bg-brand/15">+ Ajouter un créneau</button>
        {!draft.week.includes(tab) && (
          <button type="button" onClick={() => removeTemplate(tab)} className="min-h-[44px] px-2 text-sm font-semibold text-red-700 hover:underline">Supprimer ce modèle</button>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">Les créneaux sont triés par heure à l’enregistrement. Pour terminer à minuit, indiquez 23:59.</p>

      {issues.length > 0 && (
        <ul role="alert" className="mt-4 list-inside list-disc rounded-lg bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">
          {issues.map((x) => <li key={x}>{x}</li>)}
        </ul>
      )}
      {issues.length === 0 && allIssues.length > 0 && (
        <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Un autre modèle contient des erreurs : vérifiez les autres onglets.</p>
      )}
    </div>
  );
}
