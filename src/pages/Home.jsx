import { Link } from 'react-router-dom';
import ShowCard from '../components/ShowCard';
import EpisodeCard from '../components/EpisodeCard';
import ArticleCard from '../components/ArticleCard';
import { SocialSection } from '../components/SocialFeed';
import SectionTitle from '../components/SectionTitle';
import { DonateBanner, HowToWatch, Newsletter } from '../components/Sections';
import LivePlayer from '../components/LivePlayer';
import { ChevronRight } from '../components/Icons';
import { shows, getSortedEpisodes } from '../lib';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';
import { publicArticles } from '../articles';
import content from '../data/content.json';

/** Direct vMix en tête de l'accueil, de taille limitée pour laisser voir le reste de la page ; il démarre seul. */
function LiveNow() {
  const { t } = useLang();
  return (
    <section aria-labelledby="live-now" className="container-page pt-8">
      <h2 id="live-now" className="sr-only">{t('common.live')}</h2>
      <div className="mx-auto max-w-4xl">
        <LivePlayer priority sizes="(min-width: 1024px) 896px, 100vw" />
      </div>
    </section>
  );
}

export default function Home() {
  const { t } = useLang();
  useSeo({}); // titre et description : Paramètres → Identité & logo

  const pick = (flag) => (shows.some((s) => s[flag]) ? shows.filter((s) => s[flag]) : shows).slice(0, 4);
  const highlights = pick('highlight');
  const latest = getSortedEpisodes().slice(0, 8);
  // Articles : ceux « À la une » d'abord, puis les plus récents
  const published = publicArticles(content.news);
  const news = [...published.filter((a) => a.featured), ...published.filter((a) => !a.featured)].slice(0, 3);

  return (
    <>
      {!content.live.hidden && <LiveNow />}

      <section aria-labelledby="highlights" className="py-16">
        <div className="container-page">
          <SectionTitle
            id="highlights"
            title={t('home.highlights')}
            subtitle={t('home.highlightsSub')}
            action={
              <Link to="/emissions" className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-brand hover:underline">
                {t('common.seeAll')} <ChevronRight className="h-4 w-4" />
              </Link>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2">
            {highlights.map((s) => <ShowCard key={s.slug} show={s} large />)}
          </div>
        </div>
      </section>

      {/* Section masquée tant qu'aucun épisode n'est publié depuis l'admin */}
      {latest.length > 0 && (
        <section aria-labelledby="latest" className="bg-mist py-16">
          <div className="container-page">
            <SectionTitle id="latest" title={t('home.latest')} subtitle={t('home.latestSub')} />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {latest.map((e) => <EpisodeCard key={e.id} episode={e} />)}
            </div>
            <div className="mt-10 text-center">
              <Link to="/episodes" className="btn-primary px-7 py-3 text-base">{t('common.seeAllEpisodes')}</Link>
            </div>
          </div>
        </section>
      )}

      {news.length > 0 && (
        <section aria-labelledby="home-news" className="py-16">
          <div className="container-page">
            <SectionTitle
              id="home-news"
              title={t('news.homeTitle')}
              subtitle={t('news.homeSub')}
              action={
                <Link to="/actualites" className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-brand hover:underline">
                  {t('common.seeAll')} <ChevronRight className="h-4 w-4" />
                </Link>
              }
            />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {news.map((a) => <ArticleCard key={a.id} article={a} />)}
            </div>
          </div>
        </section>
      )}

      <SocialSection />

      <DonateBanner />
      <HowToWatch />
      <Newsletter />
    </>
  );
}
