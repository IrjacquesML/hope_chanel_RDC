import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Img from './Img';
import { ChevronLeft, ChevronRight, Pause, Play } from './Icons';
import { useLang } from '../i18n/LanguageContext';
import { getShow, isOnAir, scheduleForDay } from '../lib';
import { useKinshasaClock } from '../hooks/useKinshasaClock';

const INTERVAL = 7000;

export default function HeroCarousel({ slides }) {
  const { t, tr } = useLang();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [hovered, setHovered] = useState(false);
  const now = useKinshasaClock();
  const current = scheduleForDay(now.dayIndex).find((s) => isOnAir(s, now.time));
  const onAirTitle = current ? (current.show && getShow(current.show)?.title) || tr(current.title) : null;

  const go = useCallback((i) => setIndex((i + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (paused || hovered) return;
    const id = setTimeout(() => go(index + 1), INTERVAL);
    return () => clearTimeout(id);
  }, [index, paused, hovered, go]);

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="Émissions à la une"
      className="relative h-[78vh] min-h-[480px] w-full overflow-hidden bg-ink max-h-[52rem] lg:h-[calc(100vh-5rem)]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {slides.map((show, i) => (
        <div
          key={show.slug}
          role="group"
          aria-roledescription="diapositive"
          aria-label={`${i + 1} / ${slides.length} : ${show.title}`}
          aria-hidden={i !== index}
          className={`absolute inset-0 transition-opacity duration-1000 ${i === index ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          <Img
            id={show.image}
            alt=""
            width={1600}
            sizes="100vw"
            priority={i === 0}
            className={`absolute inset-0 h-full w-full transition-transform duration-[8000ms] ease-out ${i === index ? 'scale-105' : 'scale-100'}`}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/50 to-transparent" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" aria-hidden="true" />
          <div className="container-page relative flex h-full flex-col justify-end pb-24 sm:justify-center sm:pb-0">
            <div className="max-w-2xl">
              <p className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-accent">
                {t(`categories.${show.category}`)}
              </p>
              {i === 0 ? (
                <h1 className="mt-3 text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">{show.title}</h1>
              ) : (
                <h2 className="mt-3 text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">{show.title}</h2>
              )}
              <p className="mt-4 text-lg text-white/90 sm:text-xl">{tr(show.tagline)}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to={`/emissions/${show.slug}`} tabIndex={i === index ? 0 : -1} className="btn-accent px-7 py-3 text-base">
                  <Play className="h-4 w-4" />
                  {t('common.watch')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Badge EN DIRECT cliquable */}
      <Link
        to="/regarder"
        className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition hover:scale-105 hover:bg-red-700 sm:left-8 sm:top-8"
      >
        <span className="live-dot bg-white after:bg-white" aria-hidden="true" />
        {t('common.live')}
        {onAirTitle && <span className="hidden font-medium normal-case tracking-normal text-white/90 sm:inline">· {onAirTitle}</span>}
      </Link>

      {/* Contrôles */}
      <div className="absolute inset-x-0 bottom-3 z-10 sm:bottom-6">
        <div className="container-page flex items-center justify-between gap-2">
          <div className="-ml-2 flex items-center">
            {slides.map((s, i) => (
              // Zone tactile de 44 px autour d'un point visuel discret
              <button
                key={s.slug}
                type="button"
                onClick={() => go(i)}
                aria-label={`${t('home.heroGoTo')} ${s.title}`}
                aria-current={i === index}
                className="group flex h-11 min-w-[28px] items-center justify-center px-1.5"
              >
                <span className={`block h-2.5 rounded-full transition-all ${i === index ? 'w-10 bg-accent' : 'w-2.5 bg-white/60 group-hover:bg-white'}`} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {[
              [() => setPaused((p) => !p), paused ? t('home.heroPlay') : t('home.heroPause'), paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />],
              [() => go(index - 1), t('home.heroPrev'), <ChevronLeft key="l" />],
              [() => go(index + 1), t('home.heroNext'), <ChevronRight key="r" />],
            ].map(([fn, label, icon]) => (
              <button
                key={label}
                type="button"
                onClick={fn}
                aria-label={label}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white hover:text-brand"
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live={paused || hovered ? 'polite' : 'off'}>{slides[index]?.title}</p>
    </section>
  );
}
