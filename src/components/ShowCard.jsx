import { Link } from 'react-router-dom';
import Img from './Img';
import { Play } from './Icons';
import { showHasVideo } from '../lib';
import { useLang } from '../i18n/LanguageContext';

export default function ShowCard({ show, large = false }) {
  const { t, tr } = useLang();
  return (
    <Link
      to={`/emissions/${show.slug}`}
      className={`group relative block overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl ${large ? 'aspect-[4/3] sm:aspect-video' : 'aspect-video'}`}
    >
      <Img id={show.image} alt="" className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-105" sizes="(min-width: 1024px) 50vw, 100vw" width={1000} />
      <span className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent" aria-hidden="true" />
      {showHasVideo(show) && (
        <span className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-brand shadow-lg transition group-hover:scale-110" aria-hidden="true">
          <Play className="h-5 w-5 translate-x-0.5" />
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 p-5">
        <span className="inline-block rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-ink">
          {t(`categories.${show.category}`)}
        </span>
        <span className={`mt-2 block font-heading font-bold text-white ${large ? 'text-2xl' : 'text-xl'}`}>{show.title}</span>
        <span className="mt-1 block text-sm text-white/90">{tr(show.tagline)}</span>
      </span>
    </Link>
  );
}
