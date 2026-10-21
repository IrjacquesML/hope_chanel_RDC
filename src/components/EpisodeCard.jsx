import { Link } from 'react-router-dom';
import Img from './Img';
import { Clock, Play } from './Icons';
import { getShow, formatDate } from '../lib';
import { useLang } from '../i18n/LanguageContext';

export default function EpisodeCard({ episode }) {
  const { tr, lang } = useLang();
  const show = getShow(episode.show);
  const href = `/emissions/${show.slug}#${episode.id}`;
  return (
    <article className="card group relative flex flex-col">
      <div className="relative aspect-video overflow-hidden">
        <Img id={episode.image} alt="" className="h-full w-full transition duration-500 group-hover:scale-105" sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" />
        <span className="absolute inset-0 flex items-center justify-center bg-ink/0 transition group-hover:bg-ink/30">
          <span className="flex h-12 w-12 scale-90 items-center justify-center rounded-full bg-white/95 text-brand opacity-0 shadow-lg transition group-hover:scale-100 group-hover:opacity-100">
            <Play className="h-5 w-5 translate-x-0.5" />
          </span>
        </span>
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-ink/80 px-2 py-0.5 text-xs font-medium text-white">
          <Clock className="h-3.5 w-3.5" />
          {episode.duration}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">{show.title}</p>
        <h3 className="mt-1 text-base font-semibold leading-snug">
          {/* Le lien couvre toute la carte (zone tactile confortable sur mobile) */}
          <Link to={href} className="after:absolute after:inset-0 after:rounded-2xl after:content-[''] group-hover:text-brand">
            {tr(episode.title)}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-2 text-sm text-gray-600">{tr(episode.summary)}</p>
        <p className="mt-auto pt-3 text-xs text-gray-600">
          <time dateTime={episode.date}>{formatDate(episode.date, lang)}</time>
        </p>
      </div>
    </article>
  );
}
