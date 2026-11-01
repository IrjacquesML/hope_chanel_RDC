import { useEffect, useRef, useState } from 'react';
import Img from './Img';
import { liveSource } from '../lib';
import { useLang } from '../i18n/LanguageContext';
import { useLiveStatus } from '../hooks/useLiveStatus';
import { trackVideoElement } from '../analytics';
import content from '../data/content.json';

const HLS_JS = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';

/**
 * Lecteur HLS : natif sur Safari/iOS, hls.js chargé à la demande ailleurs.
 * Démarre seul, sans le son (seule lecture automatique autorisée par les navigateurs) ; un bouton active le son.
 */
function HlsPlayer({ src, fill }) {
  const { t } = useLang();
  const ref = useRef(null);
  const [muted, setMuted] = useState(true);
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
        // Direct : on reste au bord du flux, au plus près de ce que vMix envoie
        hls = new window.Hls({ liveSyncDurationCount: 3 });
        hls.loadSource(src);
        hls.attachMedia(video);
      }
    };
    document.body.appendChild(script);
    return () => hls?.destroy();
  }, [src]);
  useEffect(() => trackVideoElement(ref.current, 'live'), []);
  const unmute = () => {
    ref.current.muted = false;
    ref.current.play().catch(() => {});
  };
  return (
    <>
      <video ref={ref} controls autoPlay muted playsInline onVolumeChange={(e) => setMuted(e.target.muted)} className={`h-full w-full bg-black ${fill ? 'object-cover' : 'object-contain'}`} />
      {muted && (
        <button type="button" onClick={unmute} className="btn-accent absolute bottom-16 left-1/2 -translate-x-1/2 px-6 py-3 shadow-xl">
          🔊 {t('watch.unmute')}
        </button>
      )}
    </>
  );
}

/**
 * Lecteur du direct vMix (via Jet-Stream ou tout flux HLS) : s'affiche et démarre tout seul, sans bouton à cliquer.
 * Quand vMix est relié au site et ne diffuse pas, une image d'attente remplace le lecteur.
 * fill : le lecteur remplit son conteneur (bord à bord, sans coins arrondis) et l'image remplit le lecteur.
 */
export default function LivePlayer({ sizes = '(min-width: 1024px) 66vw, 100vw', priority = false, fill = false }) {
  const { t } = useLang();
  const { onAir } = useLiveStatus();
  const source = liveSource(content.live);
  const showPlayer = source && onAir !== false;

  return (
    <div className={`relative overflow-hidden bg-ink ${fill ? 'h-full w-full' : 'aspect-video rounded-2xl shadow-xl'}`}>
      {showPlayer ? (
        source.type === 'embed' ? (
          <iframe title="Hope Chanel RDC — direct" src={source.src} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="h-full w-full border-0" />
        ) : (
          <HlsPlayer src={source.src} fill={fill} />
        )
      ) : (
        <>
          <Img id={content.live.poster} alt="" width={1200} sizes={sizes} priority={priority} className="absolute inset-0 h-full w-full opacity-50" />
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-lg font-semibold text-white">
            {source ? t('watch.offAir') : t('watch.notConfigured')}
          </p>
        </>
      )}
      {onAir === false ? (
        <span className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-bold uppercase text-white">
          {t('watch.offAirBadge')}
        </span>
      ) : (
        <span className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase text-white">
          <span className="live-dot bg-white after:bg-white" aria-hidden="true" /> {t('common.live')}
        </span>
      )}
    </div>
  );
}
