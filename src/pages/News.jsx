import PageHeader from '../components/PageHeader';
import Img from '../components/Img';
import EmptyState from '../components/EmptyState';
import { formatDate } from '../lib';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';
import content from '../data/content.json';

export default function News() {
  const { t, tr, lang } = useLang();
  useSeo({ title: t('news.title'), description: t('news.intro') });
  return (
    <>
      <PageHeader title={t('news.title')} intro={t('news.intro')} />
      {content.news.length === 0 && <div className="container-page py-12"><EmptyState /></div>}
      <section className={`container-page grid gap-6 py-12 md:grid-cols-3 ${content.news.length ? '' : 'hidden'}`}>
        {content.news.map((n) => (
          <article key={n.id} className="card group">
            <div className="aspect-video overflow-hidden">
              <Img id={n.image} alt="" className="h-full w-full transition duration-500 group-hover:scale-105" />
            </div>
            <div className="p-6">
              <time dateTime={n.date} className="text-xs font-semibold uppercase tracking-wide text-brand">{formatDate(n.date, lang)}</time>
              <h2 className="mt-2 text-xl font-bold">{tr(n.title)}</h2>
              <p className="mt-2 text-gray-600">{tr(n.summary)}</p>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
