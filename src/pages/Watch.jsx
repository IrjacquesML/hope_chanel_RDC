import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Img from '../components/Img';
import { Play } from '../components/Icons';
import { DonateBanner } from '../components/Sections';
import { getShow, isOnAir, liveSource, scheduleForDay } from '../lib';
import { useKinshasaClock } from '../hooks/useKinshasaClock';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';
import content from '../data/content.json';
import TrackedYouTube from '../components/TrackedYouTube';
import { trackVideoElement } from '../analytics';

const HLS_JS = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';

/** Lecteur HLS : natif sur Safari/iOS, hls.js chargé à la demande ailleurs. */
function HlsPlayer({ src, poster }) {
  const ref = useRef(null);
  useEffect(() => {
    const video = ref.current;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return;
    }
    let hls;
    const script = document.createElement('script');
    script.src = HLS_JS;
    script.onload = () => {
      if (window.Hls?.isSupported()) {
        hls = new window.Hls();
        hls.loadSource(src);
        hls.attachMedia(video);
      }
    };
    document.body.appendChild(script);
    return () => hls?.destroy();
  }, [src]);
  useEffect(() => trackVideoElement(ref.current, 'live'), []);
  return <video ref={ref} poster={poster} controls autoPlay playsInline className="h-full w-full bg-black" />;
}

function slotTitle(slot, tr) {
  return (slot.show && getShow(slot.show)?.title) || tr(slot.title) || '';
}

export default function Watch() {
  const { t, tr } = useLang();
  useSeo({ title: t('watch.title'), description: t('watch.intro') });
  const [started, setStarted] = useState(false);
  const now = useKinshasaClock();
  const today = scheduleForDay(now.dayIndex);
  const currentIdx = today.findIndex((s) => isOnAir(s, now.time));
  const current = today[currentIdx];
  const next = today.slice(currentIdx + 1, currentIdx + 4);
  const { poster } = content.live;
  const source = liveSource(content.live);
  const configured = Boolean(source);

  return (
    <>
      <PageHeader title={t('watch.title')} intro={t('watch.intro')} />
      <section className="container-page grid gap-8 py-12 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-ink shadow-xl">
            {started && configured ? (
              source.type === 'hls' ? (
                <HlsPlayer src={source.src} />
              ) : (
                <TrackedYouTube title="Hope Chanel RDC — direct" src={source.src} target="live" />
              )
            ) : (
              <>
                <Img id={poster} alt="" width={1200} sizes="(min-width: 1024px) 66vw, 100vw" priority className="absolute inset-0 h-full w-full opacity-60" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                  <button type="button" onClick={() => setStarted(true)} className="btn-accent px-8 py-4 text-lg shadow-xl">
                    <Play className="h-5 w-5" /> {t('watch.start')}
                  </button>
                  <p className="max-w-md text-sm text-white/85">
                    {started && !configured ? t('watch.notConfigured') : t('watch.privacy')}
                  </p>
                </div>
              </>
            )}
            <span className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase text-white">
              <span className="live-dot bg-white after:bg-white" aria-hidden="true" /> {t('common.live')}
            </span>
          </div>
          {current && (
            <div className="mt-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-red-700">{t('home.nowOnAir')} · {current.start}–{current.end}</p>
              <h2 className="mt-1 text-2xl font-bold">{slotTitle(current, tr)}</h2>
              {current.show && <p className="mt-2 text-gray-600">{tr(getShow(current.show).description)}</p>}
            </div>
          )}
        </div>

        <aside aria-labelledby="up-next" className="rounded-2xl bg-mist p-6">
          <h2 id="up-next" className="text-lg font-bold">{t('watch.upNext')}</h2>
          <ol className="mt-4 space-y-3">
            {next.map((s) => (
              <li key={s.start} className="flex gap-4 rounded-xl bg-white p-4 shadow-sm">
                <span className="font-heading font-semibold text-brand">{s.start}</span>
                <span className="font-medium">{slotTitle(s, tr)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-gray-600">{t('common.kinshasaTime')}</p>
          <Link to="/programme" className="btn-outline mt-6 w-full">{t('nav.today')}</Link>
        </aside>
      </section>
      <DonateBanner />
    </>
  );
}
