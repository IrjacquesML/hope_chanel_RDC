import { useState } from 'react';
import { img, srcSet } from '../lib';

/**
 * Image responsive : WebP, lazy-load, srcset, et repli dégradé si l'image ne charge pas.
 */
export default function Img({ id, alt, ratio = 16 / 9, width = 800, sizes = '(min-width: 1024px) 33vw, 100vw', priority = false, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (!id || failed) {
    return <div role="img" aria-label={alt || undefined} aria-hidden={alt ? undefined : true} className={`bg-gradient-to-br from-brand via-brand-light to-accent ${className}`} />;
  }
  return (
    <img
      src={img(id, width, ratio)}
      srcSet={srcSet(id, ratio)}
      sizes={sizes}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchpriority={priority ? 'high' : undefined}
      decoding="async"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
