import { useId, useState } from 'react';
import { api, imageToWebp } from './api';
import { img } from '../lib';

/* Accès aux champs imbriqués : get(obj, 'contact.map.lat') */
export const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
export function setPath(obj, path, value) {
  const keys = path.split('.');
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur = copy;
  keys.slice(0, -1).forEach((k) => {
    cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...(cur[k] || {}) };
    cur = cur[k];
  });
  cur[keys.at(-1)] = value;
  return copy;
}

const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:bg-gray-100 disabled:text-gray-500';

function Wrapper({ id, label, hint, required, error, children, wide }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {label} {required && <span className="text-red-600" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}

function ImageInput({ id, value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      const { url } = await api.upload(await imageToWebp(file));
      onChange(url);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex gap-3">
      <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-brand to-accent">
        {value && <img src={img(value, 240)} alt="" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.opacity = 0)} />}
      </div>
      <div className="flex-1 space-y-2">
        <input id={id} value={value || ''} onChange={(e) => onChange(e.target.value.trim())} className={inputCls} placeholder="photo-… (Unsplash), URL ou /uploads/…" />
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-mist px-3 py-1.5 text-xs font-semibold text-brand hover:bg-gray-200">
          {busy ? 'Envoi…' : '⬆ Téléverser une image'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onFile} disabled={busy} />
        </label>
        {err && <p className="text-xs text-red-700">{err}</p>}
      </div>
    </div>
  );
}

function ListInput({ id, value = [], onChange }) {
  return (
    <div className="space-y-2">
      {value.map((v, i) => (
        <div key={i} className="flex gap-2">
          <input id={i === 0 ? id : undefined} value={v} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} className={inputCls} />
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-lg px-3 text-sm text-red-700 hover:bg-red-50" aria-label="Retirer">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, ''])} className="text-sm font-semibold text-brand hover:underline">+ Ajouter</button>
    </div>
  );
}

/**
 * Champ générique piloté par une définition :
 * { name, label, type: text|textarea|number|date|time|url|email|checkbox|select|i18n|i18nText|image|list, options, required, hint, wide, immutable }
 */
export function Field({ def, value, onChange, error, locked }) {
  const id = useId();
  const disabled = locked && def.immutable;
  const common = { id, disabled, className: inputCls };

  if (def.type === 'checkbox') {
    return (
      <label className={`flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-sm ${def.wide ? 'sm:col-span-2' : ''}`}>
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-brand" />
        <span>
          <span className="font-medium">{def.label}</span>
          {def.hint && <span className="block text-xs text-gray-500">{def.hint}</span>}
        </span>
      </label>
    );
  }

  let control;
  switch (def.type) {
    case 'textarea':
      control = <textarea {...common} rows={4} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'select':
      control = (
        <select {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          {!def.required && <option value="">—</option>}
          {def.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      break;
    case 'number':
      control = <input {...common} type="number" step="any" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />;
      break;
    case 'i18n':
    case 'i18nText': {
      const Tag = def.type === 'i18n' ? 'input' : 'textarea';
      control = (
        <div className="grid gap-2">
          {['fr', 'en'].map((l) => (
            <div key={l} className="flex items-start gap-2">
              <span className="mt-2 w-7 shrink-0 rounded bg-mist py-0.5 text-center text-[10px] font-bold uppercase text-gray-600">{l}</span>
              <Tag
                id={l === 'fr' ? id : undefined}
                rows={def.type === 'i18nText' ? 3 : undefined}
                value={value?.[l] || ''}
                onChange={(e) => onChange({ ...(value || {}), [l]: e.target.value })}
                className={inputCls}
                aria-label={`${def.label} (${l.toUpperCase()})`}
              />
            </div>
          ))}
        </div>
      );
      break;
    }
    case 'image':
      control = <ImageInput id={id} value={value} onChange={onChange} />;
      break;
    case 'list':
      control = <ListInput id={id} value={value} onChange={onChange} />;
      break;
    default:
      control = <input {...common} type={def.type || 'text'} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={def.placeholder} />;
  }

  return (
    <Wrapper id={id} label={def.label} hint={disabled ? 'Non modifiable après création (utilisé dans les liens).' : def.hint} required={def.required} error={error} wide={def.wide || ['textarea', 'i18nText', 'image', 'list'].includes(def.type)}>
      {control}
    </Wrapper>
  );
}

/** Vérifie les champs obligatoires. Renvoie { name: message }. */
export function validateFields(fields, item) {
  const errors = {};
  for (const f of fields) {
    const v = getPath(item, f.name);
    if (f.required) {
      const empty = f.type === 'i18n' || f.type === 'i18nText' ? !v?.fr?.trim() : v === undefined || v === null || String(v).trim() === '';
      if (empty) errors[f.name] = f.type?.startsWith('i18n') ? 'Le texte français est obligatoire' : 'Champ obligatoire';
    }
    if (f.pattern && v && !f.pattern.test(v)) errors[f.name] = f.patternMessage || 'Format invalide';
  }
  return errors;
}

export const slugify = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
