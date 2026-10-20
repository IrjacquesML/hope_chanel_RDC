import { useEffect, useState } from 'react';
import { kinshasaNow } from '../lib';

/** Heure de Kinshasa, rafraîchie chaque minute. */
export function useKinshasaClock() {
  const [now, setNow] = useState(kinshasaNow);
  useEffect(() => {
    const id = setInterval(() => setNow(kinshasaNow()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
