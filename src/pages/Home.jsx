import { Link } from 'react-router-dom';
import HeroCarousel from '../components/HeroCarousel';
import ShowCard from '../components/ShowCard';
import EpisodeCard from '../components/EpisodeCard';
import SectionTitle from '../components/SectionTitle';
import { DonateBanner, HowToWatch, Newsletter } from '../components/Sections';
import { ChevronRight } from '../components/Icons';
import { shows, getSortedEpisodes } from '../lib';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';

export default function Home() {
  const { t } = useLang();
  useSeo({ description: "Hope Chanel RDC, la télévision chrétienne de l'espoir depuis Kinshasa : direct, émissions, études bibliques, familles et santé." });

  const pick = (flag) => (shows.some((s) => s[flag]) ? shows.filter((s) => s[flag]) : shows).slice(0, 4);
  const featured = pick('featured');
  const highlights = pick('highlight');

  return (
    <>
      {featured.length > 0 && <HeroCarousel slides={featured} />}

      <section aria-labelledby="highlights" className="py-16">
        <div className="container-page">
          <SectionTitle
            id="highlights"
            title={t('home.highlights')}
            subtitle={t('home.highlightsSub')}
            action={
              <Link to="/emissions" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">
                {t('common.seeAll')} <ChevronRight className="h-4 w-4" />
              </Link>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2">
            {highlights.map((s) => <ShowCard key={s.slug} show={s} large />)}
          </div>
        </div>
      </section>

      <section aria-labelledby="latest" className="bg-mist py-16">
        <div className="container-page">
          <SectionTitle id="latest" title={t('home.latest')} subtitle={t('home.latestSub')} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {getSortedEpisodes().slice(0, 8).map((e) => <EpisodeCard key={e.id} episode={e} />)}
          </div>
          <div className="mt-10 text-center">
            <Link to="/episodes" className="btn-primary px-7 py-3 text-base">{t('common.seeAllEpisodes')}</Link>
          </div>
        </div>
      </section>

      <DonateBanner />
      <HowToWatch />
      <Newsletter />
    </>
  );
}
