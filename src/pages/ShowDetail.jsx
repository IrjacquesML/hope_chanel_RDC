import { Link, useLocation, useParams } from 'react-router-dom';
import Img from '../components/Img';
import EpisodeCard from '../components/EpisodeCard';
import SectionTitle from '../components/SectionTitle';
import { ChevronLeft, Play } from '../components/Icons';
import { getShow, img, getSortedEpisodes } from '../lib';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';
import NotFound from './NotFound';
import TrackedYouTube from '../components/TrackedYouTube';

export default function ShowDetail() {
  const { slug } = useParams();
  const { hash } = useLocation();
  const { t, tr } = useLang();
  const show = getShow(slug);
  useSeo({ title: show?.title, description: show && tr(show.description), image: show && img(show.image, 1200) });
  if (!show) return <NotFound />;

  const eps = getSortedEpisodes().filter((e) => e.show === slug);
  const playing = eps.find((e) => `#${e.id}` === hash && e.youtubeId);

  return (
    <>
      <section className="relative isolate overflow-hidden bg-ink">
        <Img id={show.image} alt="" width={1600} sizes="100vw" priority className="absolute inset-0 -z-10 h-full w-full opacity-50" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/70 to-transparent" aria-hidden="true" />
        <div className="container-page py-16 sm:py-24">
          <Link to="/emissions" className="inline-flex items-center gap-1 text-sm text-white/85 hover:text-white">
            <ChevronLeft className="h-4 w-4" /> {t('nav.shows')}
          </Link>
          <p className="mt-6 inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold text-ink">{t(`categories.${show.category}`)}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold text-white sm:text-5xl">{show.title}</h1>
          <p className="mt-3 text-lg font-medium text-accent">{tr(show.tagline)}</p>
          <p className="mt-4 max-w-2xl text-white/90">{tr(show.description)}</p>
          <p className="mt-4 text-sm text-white/80">{t('common.presentedBy')} <strong className="text-white">{show.host}</strong></p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/regarder" className="btn-accent px-7 py-3"><Play className="h-4 w-4" /> {t('common.watchLive')}</Link>
            <Link to="/programme?vue=semaine" className="btn-ghost-light px-7 py-3">{t('nav.week')}</Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="eps" className="container-page py-14">
        <SectionTitle id="eps" title={`${t('shows.episodesOf')} (${eps.length})`} />
        {playing && (
          <div className="mb-10">
            <div className="aspect-video overflow-hidden rounded-2xl bg-ink shadow-xl">
              <TrackedYouTube
                title={tr(playing.title)}
                src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(playing.youtubeId)}?autoplay=1`}
                target={playing.id}
              />
            </div>
            <h3 className="mt-4 text-xl font-bold">{tr(playing.title)}</h3>
            <p className="mt-1 text-gray-600">{tr(playing.summary)}</p>
          </div>
        )}
        {eps.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {eps.map((e) => (
              <div key={e.id} id={e.id} className="scroll-mt-28">
                <EpisodeCard episode={e} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">{t('shows.noEpisodes')}</p>
        )}
      </section>
    </>
  );
}
