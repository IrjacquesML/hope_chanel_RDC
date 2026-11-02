import Img from './Img';

/**
 * Affiche le texte enrichi d'un article (syntaxe simple, saisie dans l'administration) :
 *   ## Intertitre   ### Sous-titre   **gras**   *italique*   [texte](https://lien)
 *   - liste   1. liste numérotée   > citation   ![légende](image)
 *   une adresse YouTube seule sur sa ligne = vidéo intégrée
 * Tout est rendu en éléments React (jamais de HTML brut) : aucun script ne peut être injecté.
 */

const SAFE_URL = /^(https?:\/\/|\/(?!\/)|mailto:|tel:)/i;

export function youtubeId(url) {
  const m = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/i.exec(url.trim());
  return m?.[1] || null;
}

/** Gras, italique et liens à l'intérieur d'une ligne. */
function inline(text, key = 'i') {
  const out = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${n++}`;
    if (m[1]) out.push(<strong key={k}>{inline(m[1], k)}</strong>);
    else if (m[2]) out.push(<em key={k}>{inline(m[2], k)}</em>);
    else if (SAFE_URL.test(m[4])) {
      const external = /^https?:/i.test(m[4]);
      out.push(
        <a key={k} href={m[4]} {...(external && { target: '_blank', rel: 'noopener noreferrer' })} className="font-medium text-brand underline underline-offset-2 hover:text-brand-dark">
          {m[3]}
        </a>,
      );
    } else out.push(m[3]);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Une ligne de texte avec ses retours à la ligne simples. */
const lines = (arr, key) => arr.flatMap((l, i) => (i ? [<br key={`${key}-br${i}`} />, ...inline(l, `${key}-${i}`)] : inline(l, `${key}-${i}`)));

export default function RichText({ text = '', className = '' }) {
  const blocks = [];
  const src = text.replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  while (i < src.length) {
    const line = src[i];
    const t = line.trim();
    const k = `b${i}`;
    if (!t) {
      i++;
      continue;
    }
    let m;
    if ((m = /^(#{2,3})\s+(.+)$/.exec(t))) {
      const Tag = m[1].length === 2 ? 'h2' : 'h3';
      blocks.push(<Tag key={k} className={Tag === 'h2' ? 'mt-10 text-2xl font-bold text-ink' : 'mt-8 text-xl font-semibold text-ink'}>{inline(m[2], k)}</Tag>);
      i++;
    } else if ((m = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(t)) && (SAFE_URL.test(m[2]) || /^photo-[\w-]+$/.test(m[2]))) {
      // Image : téléversée (/uploads/…), adresse https:// ou identifiant Unsplash (photo-…)
      blocks.push(
        <figure key={k} className="my-8">
          <Img id={m[2]} alt={m[1]} width={1200} sizes="(min-width: 768px) 720px, 100vw" className="aspect-video w-full rounded-2xl" />
          {m[1] && <figcaption className="mt-2 text-center text-sm text-gray-500">{m[1]}</figcaption>}
        </figure>,
      );
      i++;
    } else if (youtubeId(t) && !/\s/.test(t)) {
      blocks.push(
        <div key={k} className="my-8 aspect-video overflow-hidden rounded-2xl bg-ink">
          <iframe
            title="Vidéo YouTube"
            src={`https://www.youtube-nocookie.com/embed/${youtubeId(t)}`}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            className="h-full w-full"
          />
        </div>,
      );
      i++;
    } else if (/^>\s?/.test(t)) {
      const quote = [];
      while (i < src.length && /^>\s?/.test(src[i].trim())) quote.push(src[i++].trim().replace(/^>\s?/, ''));
      blocks.push(<blockquote key={k} className="my-8 border-l-4 border-accent bg-mist/70 py-3 pl-5 pr-3 text-lg italic text-gray-800">{lines(quote, k)}</blockquote>);
    } else if (/^([-*]|\d+\.)\s+/.test(t)) {
      const ordered = /^\d+\./.test(t);
      const items = [];
      while (i < src.length && (ordered ? /^\d+\.\s+/ : /^[-*]\s+/).test(src[i].trim())) items.push(src[i++].trim().replace(/^([-*]|\d+\.)\s+/, ''));
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={k} className={`my-5 space-y-1.5 pl-6 ${ordered ? 'list-decimal' : 'list-disc'} marker:text-brand`}>
          {items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}
        </List>,
      );
    } else {
      const para = [];
      while (i < src.length && src[i].trim() && !/^(#{2,3}\s|>|[-*]\s|\d+\.\s|!\[)/.test(src[i].trim()) && !youtubeId(src[i].trim())) para.push(src[i++].trim());
      if (!para.length) para.push(src[i++].trim());
      blocks.push(<p key={k} className="my-5">{lines(para, k)}</p>);
    }
  }
  return <div className={`text-[1.0625rem] leading-relaxed text-gray-800 ${className}`}>{blocks}</div>;
}
