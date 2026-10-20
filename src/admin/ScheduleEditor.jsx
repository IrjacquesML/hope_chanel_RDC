import { useState } from 'react';
import { slugify } from './fields';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const TEMPLATE_LABELS = { weekday: 'Lun.–ven.', saturday: 'Samedi', sunday: 'Dimanche' };
const label = (k) => TEMPLATE_LABELS[k] || k;
const cell = 'rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand focus:outline-none';

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

export default function ScheduleEditor({ schedule, shows, onSave }) {
  const [draft, setDraft] = useState(schedule);
  const [tab, setTab] = useState(Object.keys(schedule.templates)[0]);
  const [newName, setNewName] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(schedule);
  const slots = draft.templates[tab] || [];
  const issues = checkSlots(slots);
  const allIssues = Object.values(draft.templates).flatMap(checkSlots);

  const setSlots = (next) => setDraft((d) => ({ ...d, templates: { ...d.templates, [tab]: next } }));
  const updateSlot = (i, patch) => setSlots(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const addSlot = () => {
    const last = [...slots].sort((a, b) => a.start.localeCompare(b.start)).at(-1);
    const start = last?.end && last.end !== '23:59' ? last.end : '06:00';
    const [h, m] = start.split(':').map(Number);
    const end = h >= 23 ? '23:59' : `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setSlots([...slots, { start, end, show: shows[0]?.slug }]);
  };

  const addTemplate = () => {
    const key = slugify(newName);
    if (!key || draft.templates[key]) return;
    setDraft((d) => ({ ...d, templates: { ...d.templates, [key]: [] } }));
    setTab(key);
    setNewName('');
  };

  const removeTemplate = (key) => {
    if (draft.week.includes(key)) return;
    setDraft((d) => {
      const { [key]: _, ...rest } = d.templates;
      return { ...d, templates: rest };
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
        <div className="flex gap-2">
          {dirty && <button type="button" onClick={() => setDraft(schedule)} className="rounded-full px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200">Annuler les modifications</button>}
          <button type="button" onClick={save} disabled={!dirty || allIssues.length > 0} className="btn-primary disabled:opacity-50">Enregistrer le programme</button>
        </div>
      </div>

      <section className="mb-8 rounded-xl bg-white p-5 ring-1 ring-black/5">
        <h2 className="mb-3 font-semibold">Semaine type</h2>
        <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {DAYS.map((d, i) => (
            <label key={d} className="text-sm">
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
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-brand text-white' : 'bg-white text-gray-700 ring-1 ring-black/10 hover:bg-mist'}`}
          >
            {label(k)} <span className="opacity-70">({draft.templates[k].length})</span>
          </button>
        ))}
        <span className="ml-2 flex gap-1">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nouveau modèle (ex. fete)" aria-label="Nom du nouveau modèle" className={cell} />
          <button type="button" onClick={addTemplate} className="rounded-md bg-mist px-3 text-sm font-semibold text-brand hover:bg-gray-200">+ Créer</button>
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-black/5">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-mist text-left text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-3 py-2">Début</th>
              <th className="px-3 py-2">Fin</th>
              <th className="px-3 py-2">Émission</th>
              <th className="px-3 py-2">Titre libre (si pas d’émission)</th>
              <th className="px-3 py-2">Direct</th>
              <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {slots.map((s, i) => (
              <tr key={i}>
                <td className="px-3 py-2"><input type="time" value={s.start} onChange={(e) => updateSlot(i, { start: e.target.value })} className={cell} aria-label="Début" /></td>
                <td className="px-3 py-2"><input type="time" value={s.end} onChange={(e) => updateSlot(i, { end: e.target.value })} className={cell} aria-label="Fin" /></td>
                <td className="px-3 py-2">
                  <select
                    value={s.show || ''}
                    onChange={(e) => updateSlot(i, e.target.value ? { show: e.target.value, title: undefined } : { show: undefined, title: s.title || { fr: '', en: '' } })}
                    className={cell}
                    aria-label="Émission"
                  >
                    <option value="">— Titre libre —</option>
                    {shows.map((sh) => <option key={sh.slug} value={sh.slug}>{sh.title}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  {!s.show && (
                    <div className="flex gap-1">
                      <input value={s.title?.fr || ''} onChange={(e) => updateSlot(i, { title: { ...s.title, fr: e.target.value } })} placeholder="Titre FR" aria-label="Titre FR" className={`${cell} w-36`} />
                      <input value={s.title?.en || ''} onChange={(e) => updateSlot(i, { title: { ...s.title, en: e.target.value } })} placeholder="Titre EN" aria-label="Titre EN" className={`${cell} w-36`} />
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={!!s.live} onChange={(e) => updateSlot(i, { live: e.target.checked || undefined })} className="h-4 w-4 accent-red-600" aria-label="En direct" />
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => setSlots(slots.filter((_, j) => j !== i))} className="rounded px-2 py-1 text-red-700 hover:bg-red-50" aria-label="Supprimer le créneau">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={addSlot} className="text-sm font-semibold text-brand hover:underline">+ Ajouter un créneau</button>
        {!draft.week.includes(tab) && (
          <button type="button" onClick={() => removeTemplate(tab)} className="text-sm font-semibold text-red-700 hover:underline">Supprimer ce modèle</button>
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
