import { useEffect, useMemo, useState } from 'react';
import { Field, getPath, setPath, validateFields } from './fields';
import { img } from '../lib';

/**
 * Gestion générique d'une liste d'éléments.
 * - fields : définitions des champs (voir fields.jsx)
 * - idKey : champ identifiant unique
 * - summary(item) : { title, subtitle, image }
 * - makeNew() : nouvel élément vide
 * - onSave(items) : Promise — enregistre toute la liste
 * - canDelete(item) : message d'erreur si la suppression est interdite
 * - beforeSave(item, isNew) : transforme l'élément avant validation (ex. slug auto)
 * - filters : [{ label, options:[{value,label}], test(item, value) }]
 * - sortable : autorise le réordonnancement manuel
 * - itemName : { add, new, edit } libellés des boutons et du panneau (ex. « Nouvel article »)
 * - viewUrl(item) : adresse de l'élément sur le site (lien « Voir »)
 * - wide : panneau d'édition plus large (rédaction d'articles)
 */
export default function CollectionEditor({ title, description, items, fields, idKey = 'id', summary, makeNew, onSave, canDelete, beforeSave, filters = [], sortable = false, sortItems, itemName = {}, viewUrl, wide = false }) {
  const names = { add: '+ Ajouter', new: 'Nouvel élément', edit: 'Modifier', ...itemName };
  const [editing, setEditing] = useState(null); // { item, index } ; index -1 = nouvel élément
  const [errors, setErrors] = useState({});
  const [query, setQuery] = useState('');
  const [filterValues, setFilterValues] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const onKey = (e) => e.key === 'Escape' && setEditing(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  const rows = useMemo(() => {
    let list = items.map((item, index) => ({ item, index }));
    const q = query.trim().toLowerCase();
    if (q) list = list.filter(({ item }) => JSON.stringify(item).toLowerCase().includes(q));
    filters.forEach((f, i) => {
      const v = filterValues[i];
      if (v) list = list.filter(({ item }) => f.test(item, v));
    });
    if (sortItems) list.sort((a, b) => sortItems(a.item, b.item));
    return list;
  }, [items, query, filterValues, filters, sortItems]);

  const startNew = () => {
    setErrors({});
    setEditing({ item: makeNew(), index: -1 });
  };

  const submit = async (e) => {
    e.preventDefault();
    const isNew = editing.index === -1;
    const item = beforeSave ? beforeSave(editing.item, isNew) : editing.item;
    const errs = validateFields(fields, item);
    const id = getPath(item, idKey);
    if (id && items.some((x, i) => i !== editing.index && getPath(x, idKey) === id)) errs[idKey] = 'Cet identifiant existe déjà';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const next = isNew ? [item, ...items] : items.map((x, i) => (i === editing.index ? item : x));
    setSaving(true);
    const ok = await onSave(next);
    setSaving(false);
    if (ok) setEditing(null);
  };

  const remove = async (index) => {
    const blocked = canDelete?.(items[index]);
    setConfirmDelete(null);
    if (blocked) {
      setNotice(blocked);
      return;
    }
    await onSave(items.filter((_, i) => i !== index));
  };

  const move = (index, dir) => {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[index], next[j]] = [next[j], next[index]];
    onSave(next);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
        </div>
        <button type="button" onClick={startNew} className="btn-primary">{names.add}</button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher…"
          aria-label="Rechercher"
          className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        {filters.map((f, i) => (
          <select
            key={f.label}
            aria-label={f.label}
            value={filterValues[i] || ''}
            onChange={(e) => setFilterValues((s) => ({ ...s, [i]: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">{f.label} : tous</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
      </div>

      {notice && (
        <div role="alert" className="mb-4 flex items-start justify-between gap-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          {notice}
          <button type="button" onClick={() => setNotice('')} aria-label="Fermer">✕</button>
        </div>
      )}

      <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
        {rows.length === 0 && <li className="p-6 text-center text-sm text-gray-500">Aucun élément.</li>}
        {rows.map(({ item, index }) => {
          const s = summary(item);
          return (
            <li key={getPath(item, idKey) ?? index} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 hover:bg-mist/60">
              {s.image !== undefined && (
                <div className="h-12 w-20 shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-brand to-accent">
                  {s.image && <img src={img(s.image, 160)} alt="" loading="lazy" className="h-full w-full object-cover" />}
                </div>
              )}
              <div className="min-w-0 flex-1 basis-40">
                <p className="truncate font-medium text-ink">{s.title || <em className="text-gray-400">Sans titre</em>}</p>
                {s.subtitle && <p className="truncate text-xs text-gray-500">{s.subtitle}</p>}
              </div>
              <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1">
              {s.badges?.map((b) => (
                <span key={b} className="mr-1 hidden rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-amber-900 sm:inline">{b}</span>
              ))}
              {sortable && !query && (
                <span className="flex">
                  <button type="button" onClick={() => move(index, -1)} className="rounded px-2 py-1 text-gray-500 hover:bg-gray-200" aria-label="Monter">↑</button>
                  <button type="button" onClick={() => move(index, 1)} className="rounded px-2 py-1 text-gray-500 hover:bg-gray-200" aria-label="Descendre">↓</button>
                </span>
              )}
              {viewUrl && (
                <a href={viewUrl(item)} target="_blank" rel="noopener" className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-200">
                  Voir ↗
                </a>
              )}
              <button type="button" onClick={() => { setErrors({}); setEditing({ item, index }); }} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand/10">
                Modifier
              </button>
              {confirmDelete === index ? (
                <span className="flex gap-1">
                  <button type="button" onClick={() => remove(index)} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700">Confirmer</button>
                  <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-lg px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-200">Annuler</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(index)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50">
                  Supprimer
                </button>
              )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-gray-500">{items.length} élément(s)</p>

      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)}>
          <form
            onSubmit={submit}
            noValidate
            role="dialog"
            aria-modal="true"
            aria-label={editing.index === -1 ? names.new : names.edit}
            className={`flex h-full w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} animate-fade-in flex-col bg-white shadow-2xl`}
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-bold">{editing.index === -1 ? names.new : names.edit}</h2>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100" aria-label="Fermer">✕</button>
            </div>
            <div className="grid flex-1 content-start gap-4 overflow-y-auto p-6 sm:grid-cols-2">
              {fields.map((def) => (
                <Field
                  key={def.name}
                  def={def}
                  locked={editing.index !== -1}
                  value={getPath(editing.item, def.name)}
                  error={errors[def.name]}
                  onChange={(v) => setEditing((s) => ({ ...s, item: setPath(s.item, def.name, v) }))}
                />
              ))}
            </div>
            <div className="flex items-center justify-end gap-3 border-t bg-mist px-6 py-4">
              {Object.keys(errors).length > 0 && <p className="mr-auto text-sm font-medium text-red-700">Corrigez les champs signalés.</p>}
              <button type="button" onClick={() => setEditing(null)} className="rounded-full px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200">Annuler</button>
              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
