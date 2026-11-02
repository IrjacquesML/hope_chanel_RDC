import { useId, useRef, useState } from 'react';
import { api, imageToWebp } from './api';
import { img } from '../lib';
import RichText from '../components/RichText';

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

/** Texte enrichi bilingue (corps d'un article) : barre d'outils, image téléversée, aperçu. */
function RichTextInput({ id, value, onChange, label }) {
  const [lang, setLang] = useState('fr');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ref = useRef(null);
  const text = value?.[lang] || '';
  const set = (v) => onChange({ fr: '', en: '', ...(value || {}), [lang]: v });

  /** Entoure la sélection (ou insère un modèle) puis replace le curseur. */
  const wrap = (before, after = '', placeholder = '') => {
    const ta = ref.current;
    const [s, e] = ta ? [ta.selectionStart, ta.selectionEnd] : [text.length, text.length];
    const sel = text.slice(s, e) || placeholder;
    set(text.slice(0, s) + before + sel + after + text.slice(e));
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  };
  /** Ajoute un bloc sur sa propre ligne (intertitre, liste, image, vidéo…). */
  const block = (prefix, placeholder) => {
    const ta = ref.current;
    const s = ta ? ta.selectionStart : text.length;
    const startOfLine = text.lastIndexOf('\n', s - 1) + 1;
    const end = text.indexOf('\n', s);
    const lineText = text.slice(startOfLine, end === -1 ? text.length : end);
    set(text.slice(0, startOfLine) + prefix + (lineText.trim() ? '' : placeholder) + text.slice(startOfLine));
    requestAnimationFrame(() => ta?.focus());
  };
  const insertLine = (line) => {
    const ta = ref.current;
    const s = ta ? ta.selectionEnd : text.length;
    const before = text.slice(0, s).replace(/\n*$/, '');
    set(`${before}${before ? '\n\n' : ''}${line}\n\n${text.slice(s).replace(/^\n*/, '')}`);
  };
  const link = () => {
    const url = window.prompt('Adresse du lien (https://…)', 'https://');
    if (url && /^(https?:\/\/|\/|mailto:)/.test(url.trim())) wrap('[', `](${url.trim()})`, 'texte du lien');
  };
  const video = () => {
    const url = window.prompt('Adresse de la vidéo YouTube (https://www.youtube.com/watch?v=…)');
    if (url?.trim()) insertLine(url.trim());
  };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      const { url } = await api.upload(await imageToWebp(file));
      const caption = window.prompt('Légende de l’image (facultatif)') || '';
      insertLine(`![${caption.replace(/[[\]]/g, '')}](${url})`);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const tool = 'rounded-md px-2.5 py-1.5 text-sm font-semibold text-gray-700 hover:bg-white hover:text-brand disabled:opacity-40';
  return (
    <div className="overflow-hidden rounded-lg border border-gray-300 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-mist px-2 py-1.5">
        {['fr', 'en'].map((l) => (
          <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} className={`mr-1 rounded-md px-2 py-1 text-xs font-bold uppercase ${lang === l ? 'bg-brand text-white' : 'text-gray-600 hover:bg-white'}`}>
            {l}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-gray-300" aria-hidden="true" />
        <button type="button" disabled={preview} onClick={() => wrap('**', '**', 'texte en gras')} className={tool} title="Gras"><b>G</b></button>
        <button type="button" disabled={preview} onClick={() => wrap('*', '*', 'texte en italique')} className={tool} title="Italique"><i>I</i></button>
        <button type="button" disabled={preview} onClick={() => block('## ', 'Intertitre')} className={tool} title="Intertitre">Intertitre</button>
        <button type="button" disabled={preview} onClick={link} className={tool} title="Lien">Lien</button>
        <button type="button" disabled={preview} onClick={() => block('- ', 'élément de liste')} className={tool} title="Liste à puces">• Liste</button>
        <button type="button" disabled={preview} onClick={() => block('> ', 'citation')} className={tool} title="Citation">« Citation »</button>
        <label className={`${tool} cursor-pointer ${preview || busy ? 'pointer-events-none opacity-40' : ''}`} title="Image">
          {busy ? 'Envoi…' : 'Image'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onFile} disabled={busy || preview} />
        </label>
        <button type="button" disabled={preview} onClick={video} className={tool} title="Vidéo YouTube">Vidéo</button>
        <button type="button" onClick={() => setPreview((p) => !p)} aria-pressed={preview} className={`ml-auto rounded-md px-3 py-1.5 text-sm font-semibold ${preview ? 'bg-brand text-white' : 'text-brand hover:bg-white'}`}>
          {preview ? 'Modifier' : 'Aperçu'}
        </button>
      </div>
      {preview ? (
        <div className="max-h-[32rem] min-h-[16rem] overflow-y-auto bg-white px-5 py-2">
          {text.trim() ? <RichText text={text} /> : <p className="py-6 text-sm text-gray-500">Rien à afficher pour l’instant ({lang.toUpperCase()}).</p>}
        </div>
      ) : (
        <textarea
          id={id}
          ref={ref}
          rows={16}
          value={text}
          onChange={(e) => set(e.target.value)}
          aria-label={`${label} (${lang.toUpperCase()})`}
          placeholder={lang === 'fr' ? 'Écrivez l’article ici. Laissez une ligne vide entre deux paragraphes.' : 'English version (optional): if empty, the French text is shown.'}
          className="block w-full resize-y border-0 px-4 py-3 text-[0.95rem] leading-relaxed text-ink focus:outline-none"
        />
      )}
      {err && <p className="border-t border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">{err}</p>}
    </div>
  );
}

/** Liste de liens { name, url } (ex. partenaires du pied de page). */
function LinksInput({ id, value = [], onChange }) {
  const set = (i, key, v) => onChange(value.map((x, j) => (j === i ? { ...x, [key]: v } : x)));
  return (
    <div className="space-y-2">
      {value.map((v, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
          <input id={i === 0 ? id : undefined} value={v.name || ''} onChange={(e) => set(i, 'name', e.target.value)} placeholder="Nom" aria-label={`Nom du partenaire ${i + 1}`} className={inputCls} />
          <input type="url" value={v.url || ''} onChange={(e) => set(i, 'url', e.target.value.trim())} placeholder="https://www.exemple.org" aria-label={`Lien du partenaire ${i + 1}`} className={inputCls} />
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-lg px-3 text-sm text-red-700 hover:bg-red-50" aria-label="Retirer">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { name: '', url: '' }])} className="text-sm font-semibold text-brand hover:underline">+ Ajouter un partenaire</button>
    </div>
  );
}

function ColorInput({ id, value, onChange }) {
  const valid = /^#[\da-f]{6}$/i.test(value || '');
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={valid ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-gray-300 bg-white p-1" aria-label="Choisir la couleur" />
      <input id={id} value={value || ''} onChange={(e) => onChange(e.target.value.trim())} className={`${inputCls} font-mono uppercase`} placeholder="#0B3C7A" maxLength={7} aria-invalid={!valid} />
    </div>
  );
}

/** Champ confidentiel (clé de diffusion, mot de passe) : masqué par défaut, avec bouton « Copier ». */
function SecretInput({ id, value, onChange, placeholder }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers indisponible */
    }
  };
  return (
    <div className="flex gap-2">
      <input id={id} type={shown ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} font-mono`} />
      <button type="button" onClick={() => setShown((v) => !v)} className="shrink-0 rounded-lg px-3 text-xs font-semibold text-brand hover:bg-brand/10">{shown ? 'Masquer' : 'Afficher'}</button>
      {value && <button type="button" onClick={copy} className="shrink-0 rounded-lg px-3 text-xs font-semibold text-brand hover:bg-brand/10">{copied ? 'Copié ✓' : 'Copier'}</button>}
    </div>
  );
}

/**
 * Champ générique piloté par une définition :
 * { name, label, type: text|textarea|number|date|time|url|email|checkbox|select|i18n|i18nText|image|list|links|richtext|color|secret, options, required, hint, wide, immutable }
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
              <span className="mt-2 w-7 shrink-0 rounded bg-mist py-0.5 text-center text-[11px] font-bold uppercase text-gray-600">{l}</span>
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
    case 'links':
      control = <LinksInput id={id} value={value} onChange={onChange} />;
      break;
    case 'richtext':
      control = <RichTextInput id={id} value={value} onChange={onChange} label={def.label} />;
      break;
    case 'color':
      control = <ColorInput id={id} value={value} onChange={onChange} />;
      break;
    case 'secret':
      control = <SecretInput id={id} value={value} onChange={onChange} placeholder={def.placeholder} />;
      break;
    default:
      control = <input {...common} type={def.type || 'text'} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={def.placeholder} />;
  }

  return (
    <Wrapper id={id} label={def.label} hint={disabled ? 'Non modifiable après création (utilisé dans les liens).' : def.hint} required={def.required} error={error} wide={def.wide || ['textarea', 'i18nText', 'image', 'list', 'links', 'richtext'].includes(def.type)}>
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
