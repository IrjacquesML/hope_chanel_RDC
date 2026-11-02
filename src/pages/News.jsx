import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import ArticleCard from '../components/ArticleCard';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';
import { publicArticles, plainText, rubriquesOf } from '../articles';
import content from '../data/content.json';

const PAGE = 12;

export default function News() {
  const { t, tr } = useLang();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  useSeo({ title: t('news.title'), description: t('news.intro') });

  const all = publicArticles(content.news);
  const rubrique = params.get('rubrique') || '';
  // Seules les rubriques qui ont au moins un article publié sont proposées en filtre
  const rubriques = rubriquesOf(content).filter((r) => all.some((a) => a.category === r.id));
  const q = query.trim().toLowerCase();
  const filtered = all.filter(
    (a) =>
      (!rubrique || a.category === rubrique) &&
      (!q || [tr(a.title), a.title.fr, tr(a.summary), plainText(tr(a.body) || a.body?.fr), a.author].join(' ').toLowerCase().includes(q)),
  );
  // Article à la une : le plus récent marqué « À la une », sinon le plus récent (vue non filtrée uniquement)
  const lead = !rubrique && !q ? all.find((a) => a.featured) || all[0] : null;
  const rest = filtered.filter((a) => a !== lead);

  const choose = (id) => {
    setLimit(PAGE);
    setParams(id ? { rubrique: id } : {}, { replace: true });
  };
  const chip = (active) => `min-h-[40px] rounded-full px-4 text-sm font-semibold transition ${active ? 'bg-brand text-white' : 'bg-white text-gray-700 ring-1 ring-black/10 hover:text-brand'}`;

  return (
    <>
      <PageHeader title={t('news.title')} intro={t('news.intro')} />
      {all.length === 0 ? (
        <div className="container-page py-12"><EmptyState /></div>
      ) : (
        <div className="container-page py-12">
          {lead && <div className="mb-10"><ArticleCard article={lead} large /></div>}

          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {rubriques.length > 1 ? (
              <div role="group" aria-label={t('news.rubriques')} className="flex flex-wrap gap-2">
                <button type="button" onClick={() => choose('')} aria-pressed={!rubrique} className={chip(!rubrique)}>{t('common.allCategories')}</button>
                {rubriques.map((r) => (
                  <button key={r.id} type="button" onClick={() => choose(r.id)} aria-pressed={rubrique === r.id} className={chip(rubrique === r.id)}>{tr(r.label)}</button>
                ))}
              </div>
            ) : <span />}
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }}
              placeholder={t('news.search')}
              aria-label={t('news.search')}
              className="w-full rounded-full border border-gray-300 bg-white px-5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 lg:max-w-xs"
            />
          </div>

          {rest.length === 0 && !lead && <p className="py-10 text-center text-gray-600">{t('news.noResult')}</p>}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.slice(0, limit).map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
          {rest.length > limit && (
            <div className="mt-10 text-center">
              <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="btn-outline px-7 py-3">{t('news.more')}</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
