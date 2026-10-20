import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import ShowCard from '../components/ShowCard';
import { categories, shows } from '../lib';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';

export default function Shows() {
  const { t } = useLang();
  const [params, setParams] = useSearchParams();
  const active = params.get('categorie') || 'all';
  useSeo({ title: t('shows.title'), description: t('shows.intro') });

  const used = categories.map((c) => c.id).filter((id) => shows.some((s) => s.category === id));
  const list = active === 'all' ? shows : shows.filter((s) => s.category === active);

  return (
    <>
      <PageHeader title={t('shows.title')} intro={t('shows.intro')} />
      <section className="container-page py-10">
        <div role="group" aria-label={t('shows.filterLabel')} className="flex flex-wrap gap-2">
          {['all', ...used].map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={active === c}
              onClick={() => setParams(c === 'all' ? {} : { categorie: c })}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${active === c ? 'bg-brand text-white shadow' : 'bg-mist text-gray-700 hover:bg-gray-200'}`}
            >
              {c === 'all' ? t('common.allCategories') : t(`categories.${c}`)}
            </button>
          ))}
        </div>
        <p className="sr-only" aria-live="polite">{list.length} {t('shows.title').toLowerCase()}</p>
        {list.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => <ShowCard key={s.slug} show={s} />)}
          </div>
        ) : (
          <p className="mt-8 text-gray-600">{t('shows.none')}</p>
        )}
      </section>
    </>
  );
}
