import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Img from './Img';
import SectionTitle from './SectionTitle';
import { ChevronRight, Facebook, Instagram, Play, YouTube } from './Icons';
import { formatDate } from '../lib';
import { useLang } from '../i18n/LanguageContext';

export const NETWORKS = {
  youtube: { label: 'YouTube', Icon: YouTube, color: 'bg-red-600' },
  facebook: { label: 'Facebook', Icon: Facebook, color: 'bg-[#1877F2]' },
  instagram: { label: 'Instagram', Icon: Instagram, color: 'bg-[#C13584]' },
};

/** Contenus publiés des réseaux sociaux (synchronisés par le serveur). null = chargement. */
export function useSocialFeed(limit = 12, network = '') {
  const [feed, setFeed] = useState(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/social/feed?limit=${limit}${network ? `&network=${network}` : ''}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { items: [], networks: [] }))
      .then(setFeed)
      .catch((e) => e.name !== 'AbortError' && setFeed({ items: [], networks: [] }));
    return () => ctrl.abort();
  }, [limit, network]);
  return feed;
}

export function SocialCard({ item }) {
  const { t, lang } = useLang();
  const { label, Icon, color } = NETWORKS[item.network] || NETWORKS.youtube;
  const text = item.title || item.text;
  return (
    <article className="card group relative flex flex-col">
      <div className="relative aspect-video overflow-hidden bg-ink">
        <Img id={item.image} alt="" className="h-full w-full transition duration-500 group-hover:scale-105" />
        {item.type === 'video' && (
          <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white transition group-hover:bg-accent group-hover:text-ink"><Play className="h-6 w-6" /></span>
          </span>
        )}
        <span className={`absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-white shadow ${color}`}><Icon className="h-4 w-4" /></span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <time dateTime={item.date} className="text-xs font-semibold uppercase tracking-wide text-gray-500">{formatDate(item.date.slice(0, 10), lang)}</time>
        <h3 className="mt-1 line-clamp-3 font-semibold leading-snug text-ink">
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="after:absolute after:inset-0 group-hover:text-brand">
            {text || t('social.untitled')}
            <span className="sr-only"> — {t('social.openOn')} {label}</span>
          </a>
        </h3>
        <p className="mt-auto pt-3 text-sm font-semibold text-brand">{t('social.openOn')} {label} ↗</p>
      </div>
    </article>
  );
}

/** Bloc de l'accueil : masqué tant qu'aucun contenu n'est publié. */
export function SocialSection() {
  const { t } = useLang();
  const feed = useSocialFeed(6);
  if (!feed?.items.length) return null;
  return (
    <section aria-labelledby="home-social" className="bg-mist py-16">
      <div className="container-page">
        <SectionTitle
          id="home-social"
          title={t('social.title')}
          subtitle={t('social.intro')}
          action={
            <Link to="/sur-nos-reseaux" className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-brand hover:underline">
              {t('common.seeAll')} <ChevronRight className="h-4 w-4" />
            </Link>
          }
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {feed.items.map((i) => <SocialCard key={i.key} item={i} />)}
        </div>
      </div>
    </section>
  );
}
