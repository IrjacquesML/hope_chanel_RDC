import { Link } from 'react-router-dom';
import Img from './Img';
import { formatDate } from '../lib';
import { useLang } from '../i18n/LanguageContext';
import { articleSlug, rubriquesOf } from '../articles';
import content from '../data/content.json';

/** Nom de la rubrique d'un article, dans la langue du visiteur. */
export function useRubriqueLabel() {
  const { tr } = useLang();
  return (id) => tr(rubriquesOf(content).find((r) => r.id === id)?.label) || '';
}

/** Carte d'article (liste des actualités, accueil, articles liés). large = article à la une. */
export default function ArticleCard({ article, large = false }) {
  const { tr, lang } = useLang();
  const rubrique = useRubriqueLabel()(article.category);
  const to = `/actualites/${articleSlug(article)}`;
  return (
    <article className={`card group relative flex flex-col ${large ? 'lg:grid lg:grid-cols-[1.4fr_1fr]' : ''}`}>
      <div className={`overflow-hidden ${large ? 'aspect-video lg:aspect-auto lg:h-full' : 'aspect-video'}`}>
        <Img id={article.image} alt="" priority={large} width={large ? 1200 : 800} sizes={large ? '(min-width: 1024px) 60vw, 100vw' : '(min-width: 1024px) 33vw, 100vw'} className="h-full w-full transition duration-500 group-hover:scale-105" />
      </div>
      <div className={`flex flex-1 flex-col ${large ? 'p-6 lg:p-10' : 'p-6'}`}>
        <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold uppercase tracking-wide text-brand">
          {rubrique && <span>{rubrique}</span>}
          {rubrique && <span aria-hidden="true">·</span>}
          <time dateTime={article.date} className="text-gray-500">{formatDate(article.date, lang)}</time>
        </p>
        <h2 className={`mt-2 font-bold leading-snug text-ink ${large ? 'text-2xl sm:text-3xl' : 'text-xl'}`}>
          {/* Lien étendu à toute la carte */}
          <Link to={to} className="after:absolute after:inset-0 group-hover:text-brand">{tr(article.title) || article.title.fr}</Link>
        </h2>
        <p className={`mt-3 text-gray-600 ${large ? 'text-lg' : 'line-clamp-3'}`}>{tr(article.summary) || article.summary?.fr}</p>
      </div>
    </article>
  );
}
