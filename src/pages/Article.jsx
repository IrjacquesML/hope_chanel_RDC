import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Img from '../components/Img';
import RichText from '../components/RichText';
import ArticleCard, { useRubriqueLabel } from '../components/ArticleCard';
import { ChevronLeft, Facebook, WhatsApp, XIcon } from '../components/Icons';
import { formatDate, img, viewer } from '../lib';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';
import { siteUrl } from '../siteSettings';
import { articleSlug, articleStatus, isPublished, publicArticles, readingMinutes } from '../articles';
import content from '../data/content.json';
import NotFound from './NotFound';

function Share({ url, title }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const links = [
    ['WhatsApp', WhatsApp, `https://wa.me/?text=${enc(`${title} ${url}`)}`],
    ['Facebook', Facebook, `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`],
    ['X', XIcon, `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`],
  ];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible */
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-semibold text-gray-700">{t('news.share')}</span>
      {links.map(([label, Icon, href]) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${t('news.share')} : ${label}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-mist text-brand transition hover:bg-brand hover:text-white">
          <Icon className="h-4 w-4" />
        </a>
      ))}
      <button type="button" onClick={copy} className="min-h-[40px] rounded-full bg-mist px-4 text-sm font-semibold text-brand hover:bg-brand hover:text-white">
        {copied ? t('news.copied') : t('news.copyLink')}
      </button>
    </div>
  );
}

export default function Article() {
  const { slug } = useParams();
  const { t, tr, lang } = useLang();
  const rubriqueLabel = useRubriqueLabel();
  const article = content.news.find((a) => articleSlug(a) === slug);
  // Les brouillons ne sont envoyés qu'à l'équipe connectée : elle peut les relire ici avant publication.
  const visible = article && (isPublished(article) || viewer.admin);
  const title = visible ? tr(article.title) || article.title.fr : '';
  const summary = visible ? tr(article.summary) || article.summary?.fr : '';
  useSeo({ title: title || undefined, description: summary || undefined, image: visible && article.image ? img(article.image, 1200, 1200 / 630) : undefined });
  if (!visible) return <NotFound />;

  const body = tr(article.body) || article.body?.fr || '';
  const status = articleStatus(article);
  const all = publicArticles(content.news).filter((a) => a.id !== article.id);
  const related = [...all.filter((a) => a.category === article.category), ...all.filter((a) => a.category !== article.category)].slice(0, 3);
  const rubrique = rubriqueLabel(article.category);
  const url = `${siteUrl()}/actualites/${articleSlug(article)}`;

  return (
    <>
      {status !== 'published' && (
        <p role="status" className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900">
          {status === 'draft' ? t('news.draftPreview') : t('news.scheduledPreview').replace('{date}', formatDate(article.date, lang))}
        </p>
      )}
      <article className="pb-16">
        <header className="container-page max-w-3xl pt-10">
          <Link to="/actualites" className="inline-flex min-h-[40px] items-center gap-1 text-sm font-semibold text-brand hover:underline">
            <ChevronLeft className="h-4 w-4" /> {t('news.title')}
          </Link>
          {rubrique && (
            <p className="mt-4">
              <Link to={`/actualites?rubrique=${article.category}`} className="text-xs font-bold uppercase tracking-wider text-brand hover:underline">{rubrique}</Link>
            </p>
          )}
          <h1 className="mt-2 text-3xl font-bold leading-tight text-ink sm:text-4xl">{title}</h1>
          {summary && <p className="mt-4 text-xl leading-relaxed text-gray-700">{summary}</p>}
          <p className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500">
            {article.author && <span>{t('news.by')} <strong className="font-semibold text-gray-700">{article.author}</strong></span>}
            <time dateTime={article.date}>{formatDate(article.date, lang)}</time>
            {body && <span>· {t('news.readingTime').replace('{n}', readingMinutes(body))}</span>}
          </p>
        </header>

        {article.image && (
          <figure className="container-page mt-8 max-w-4xl">
            <Img id={article.image} alt={article.imageCaption || ''} priority width={1400} sizes="(min-width: 1024px) 896px, 100vw" className="aspect-video w-full rounded-3xl" />
            {article.imageCaption && <figcaption className="mt-2 text-center text-sm text-gray-500">{article.imageCaption}</figcaption>}
          </figure>
        )}

        <div className="container-page max-w-3xl">
          {body && <RichText text={body} className="mt-6" />}
          <div className="mt-10 border-t border-gray-200 pt-6">
            <Share url={url} title={title} />
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="related" className="bg-mist py-14">
          <div className="container-page">
            <h2 id="related" className="mb-6 text-2xl font-bold">{t('news.related')}</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((a) => <ArticleCard key={a.id} article={a} />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
