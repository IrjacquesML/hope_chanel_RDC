import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from './translations';
import { categoryLabel } from '../lib';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'hc-lang';

function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'fr' || saved === 'en') return saved;
  } catch {
    /* storage unavailable */
  }
  return 'fr';
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable */
    }
  }, [lang]);

  // t('home.latest') -> UI string ; returns arrays/objects as-is
  const t = useCallback(
    (key) => {
      // Les catégories sont gérées dans les données (admin), pas dans les traductions.
      if (key.startsWith('categories.')) return categoryLabel(key.slice(11), lang);
      return key.split('.').reduce((o, k) => (o == null ? o : o[k]), translations[lang]) ?? key;
    },
    [lang],
  );

  // tr({ fr, en }) -> localized content value from JSON data
  const tr = useCallback(
    (value) => (value && typeof value === 'object' ? value[lang] ?? value.fr : value),
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t, tr }), [lang, t, tr]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  return useContext(LanguageContext);
}
