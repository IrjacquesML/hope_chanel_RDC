import { useEffect, useMemo, useRef } from 'react';
import { trackYouTubeIframe, withYouTubeApi } from '../analytics';

/** Iframe YouTube dont la lecture est mesurée (lancements + temps regardé). */
export default function TrackedYouTube({ src, title, target, className = 'h-full w-full' }) {
  const ref = useRef(null);
  const fullSrc = useMemo(() => withYouTubeApi(src), [src]);
  useEffect(() => trackYouTubeIframe(ref.current, target), [fullSrc, target]);
  return (
    <iframe
      ref={ref}
      title={title}
      src={fullSrc}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      className={className}
    />
  );
}
