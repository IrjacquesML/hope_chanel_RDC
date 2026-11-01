import { Link } from 'react-router-dom';
import ShowCard from '../components/ShowCard';
import EpisodeCard from '../components/EpisodeCard';
import SectionTitle from '../components/SectionTitle';
import { DonateBanner, HowToWatch, Newsletter } from '../components/Sections';
import LivePlayer from '../components/LivePlayer';
import { ChevronRight } from '../components/Icons';
import { shows, getSortedEpisodes } from '../lib';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';

/** Direct vMix en tête de l'accueil : bord à bord, à la hauteur de l'écran sous l'en-tête, sans texte autour ; il démarre seul. */
function LiveNow() {
  const { t } = useLang();
  return (
    // Hauteur : 16:9 sur toute la largeur, sans dépasser l'écran sous l'en-tête (h-16, puis h-20 en xl)
    <section aria-labelledby="live-now" className="h-[min(56.25vw,calc(100svh-4rem))] bg-black xl:h-[min(56.25vw,calc(100svh-5rem))]">
      <h2 id="live-now" className="sr-only">{t('common.live')}</h2>
      <LivePlayer priority fill sizes="100vw" />
    </section>
  );
}

export default function Home() {
  const { t } = useLang();
  useSeo({}); // titre et description : Paramètres → Identité & logo

  const pick = (flag) => (shows.some((s) => s[flag]) ? shows.filter((s) => s[flag]) : shows).slice(0, 4);
  const highlights = pick('highlight');
  const latest = getSortedEpisodes().slice(0, 8);

  return (
    <>
      <LiveNow />

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

      <DonateBanner />
      <HowToWatch />
      <Newsletter />
    </>
  );
}
