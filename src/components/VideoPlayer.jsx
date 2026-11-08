import { useEffect, useRef } from 'react';
import { img } from '../lib';
import { trackVideoElement } from '../analytics';

/** Lecteur des vidéos téléversées sur le site : la lecture est mesurée comme pour YouTube (lancements + temps regardé). */
export default function VideoPlayer({ src, poster, title, target, autoPlay = false }) {
  const ref = useRef(null);
  useEffect(() => trackVideoElement(ref.current, target), [src, target]);
  return (
    <video
      key={src}
      ref={ref}
      src={src}
      poster={poster ? img(poster, 1200) : undefined}
      aria-label={title}
      controls
      playsInline
      preload="metadata"
      autoPlay={autoPlay}
      className="h-full w-full bg-black object-contain"
    />
  );
}
