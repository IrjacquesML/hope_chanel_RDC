import { Link, useLocation, useParams } from 'react-router-dom';
import Img from '../components/Img';
import EpisodeCard from '../components/EpisodeCard';
import SectionTitle from '../components/SectionTitle';
import { ChevronLeft, Play } from '../components/Icons';
import { getShow, img, getSortedEpisodes, hasVideo } from '../lib';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';
import NotFound from './NotFound';
import TrackedYouTube from '../components/TrackedYouTube';
import VideoPlayer from '../components/VideoPlayer';

export default function ShowDetail() {
  const { slug } = useParams();
  const { hash } = useLocation();
  const { t, tr } = useLang();
  const show = getShow(slug);
  useSeo({ title: show?.title, description: show && tr(show.description), image: show && img(show.image, 1200) });
  if (!show) return <NotFound />;

  const eps = getSortedEpisodes().filter((e) => e.show === slug);
  // Lue dès l'arrivée : l'épisode choisi, sinon la vidéo de l'émission, sinon le dernier épisode disponible
  const requested = eps.find((e) => `#${e.id}` === hash && hasVideo(e));
  const episode = requested || (show.video ? null : eps.find(hasVideo));
  const media = episode || (show.video ? show : null);
  const mediaTitle = episode ? tr(episode.title) : show.title;

  const back = (
    <Link to="/emissions" className="-ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-full px-2 text-sm text-white/85 hover:text-white">
      <ChevronLeft className="h-4 w-4" /> {t('nav.shows')}
    </Link>
  );
  const details = (
    <>
      <p className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold text-ink">{t(`categories.${show.category}`)}</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-bold text-white sm:text-5xl">{show.title}</h1>
      <p className="mt-3 text-lg font-medium text-accent">{tr(show.tagline)}</p>
      <p className="mt-4 max-w-2xl text-white/90">{tr(show.description)}</p>
      <p className="mt-4 text-sm text-white/80">{t('common.presentedBy')} <strong className="text-white">{show.host}</strong></p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/regarder" className="btn-accent px-7 py-3"><Play className="h-4 w-4" /> {t('common.watchLive')}</Link>
        <Link to="/programme?vue=semaine" className="btn-ghost-light px-7 py-3">{t('nav.week')}</Link>
      </div>
    </>
  );

  return (
    <>
      {media ? (
        <section id={requested?.id} className="scroll-mt-28 bg-ink">
          <div className="container-page pb-12 pt-3 sm:pt-4">
            {back}
            {/* Le lecteur tient dans la hauteur de l'écran, sans avoir à défiler */}
            <div className="mx-auto mt-2 aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-xl" style={{ maxWidth: 'min(64rem, calc(72vh * 16 / 9))' }}>
              {media.video ? (
                <VideoPlayer src={media.video} poster={media.image} title={mediaTitle} target={episode?.id || show.slug} autoPlay />
              ) : (
                <TrackedYouTube
                  title={mediaTitle}
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(media.youtubeId)}?autoplay=1`}
                  target={episode.id}
                />
              )}
            </div>
            {episode && (
              <div className="mx-auto mt-4 max-w-5xl">
                <h2 className="text-xl font-bold text-white">{mediaTitle}</h2>
                <p className="mt-1 text-white/80">{tr(episode.summary)}</p>
              </div>
            )}
            <div className="mt-8">{details}</div>
          </div>
        </section>
      ) : (
        <section className="relative isolate overflow-hidden bg-ink">
          <Img id={show.image} alt="" width={1600} sizes="100vw" priority className="absolute inset-0 -z-10 h-full w-full opacity-50" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/70 to-transparent" aria-hidden="true" />
          <div className="container-page py-16 sm:py-24">
            {back}
            <div className="mt-6">{details}</div>
          </div>
        </section>
      )}

      <section aria-labelledby="eps" className="container-page py-14">
        <SectionTitle id="eps" title={`${t('shows.episodesOf')} (${eps.length})`} />
        {eps.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {eps.map((e) => (
              // L'épisode lu porte son ancre sur le lecteur : le clic amène au lecteur, pas à la carte
              <div key={e.id} id={e.id === requested?.id ? undefined : e.id} className="scroll-mt-28">
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
