import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Logo from './Logo';
import MobileMenu from './MobileMenu';
import { ChevronDown, Close, Heart, MenuIcon } from './Icons';
import { useLang } from '../i18n/LanguageContext';

export const NAV = [
  {
    key: 'watch',
    children: [
      { key: 'live', to: '/regarder' },
      { key: 'today', to: '/programme' },
      { key: 'week', to: '/programme?vue=semaine' },
      { key: 'howToWatch', to: '/comment-nous-regarder' },
    ],
  },
  { key: 'shows', to: '/emissions' },
  {
    key: 'donations',
    children: [
      { key: 'regular', to: '/dons/reguliers' },
      { key: 'testimonials', to: '/dons/temoignages' },
    ],
  },
  { key: 'events', to: '/evenements' },
  {
    key: 'about',
    children: [
      { key: 'team', to: '/apropos#equipe' },
      { key: 'contact', to: '/contact' },
      { key: 'news', to: '/actualites' },
    ],
  },
  { key: 'network', to: '/reseau' },
];

function LangSwitch({ className = '' }) {
  const { lang, setLang, t } = useLang();
  return (
    <div role="group" aria-label={t('common.language')} className={`inline-flex rounded-full bg-mist p-0.5 text-xs font-semibold ${className}`}>
      {['fr', 'en'].map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          lang={l}
          className={`rounded-full px-2.5 py-1 uppercase transition ${lang === l ? 'bg-brand text-white' : 'text-gray-700 hover:text-brand'}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

const linkCls = ({ isActive }) =>
  `rounded-full px-3 py-2 text-sm font-medium transition hover:bg-mist hover:text-brand ${isActive ? 'text-brand' : 'text-ink'}`;

function Dropdown({ item, open, onToggle, onClose }) {
  const { t } = useLang();
  const ref = useRef(null);
  const { pathname } = useLocation();
  const active = item.children.some((c) => pathname === c.to.split(/[?#]/)[0]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => !ref.current?.contains(e.target) && onClose();
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose]);

  return (
    <li
      ref={ref}
      className="relative"
      onMouseEnter={() => onToggle(true)}
      onMouseLeave={() => onToggle(false)}
      onKeyDown={(e) => e.key === 'Escape' && onClose(true)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`menu-${item.key}`}
        onClick={() => onToggle(!open)}
        className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition hover:bg-mist hover:text-brand ${active ? 'text-brand' : 'text-ink'}`}
      >
        {t(`nav.${item.key}`)}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full pt-2">
          <ul id={`menu-${item.key}`} className="w-60 animate-fade-in rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/5">
            {item.children.map((c) => (
              <li key={c.key}>
                <Link to={c.to} className="block rounded-xl px-3 py-2 text-sm text-ink transition hover:bg-mist hover:text-brand">
                  {t(`nav.${c.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

export default function Header() {
  const { t } = useLang();
  const [openKey, setOpenKey] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const burgerRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpenKey(null);
    setMobileOpen(false);
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Le menu mobile n'a plus de sens au-delà de 1280 px (menu complet affiché)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const onChange = (e) => e.matches && setMobileOpen(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <header className={`sticky top-0 z-50 bg-white/95 backdrop-blur transition-shadow ${scrolled ? 'shadow-md' : 'border-b border-gray-100'}`}>
      <div className="container-page flex h-16 items-center justify-between gap-4 xl:h-20">
        <Link to="/" aria-label="Hope Chanel RDC — Accueil" className="shrink-0">
          <Logo />
        </Link>

        <nav aria-label="Navigation principale" className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) =>
              item.children ? (
                <Dropdown
                  key={item.key}
                  item={item}
                  open={openKey === item.key}
                  onToggle={(v) => setOpenKey(v ? item.key : null)}
                  onClose={() => setOpenKey(null)}
                />
              ) : (
                <li key={item.key}>
                  <NavLink to={item.to} className={linkCls}>{t(`nav.${item.key}`)}</NavLink>
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <LangSwitch className="hidden sm:inline-flex" />
          <Link to="/dons" className="btn-accent hidden sm:inline-flex">
            <Heart className="h-4 w-4" />
            {t('common.donate')}
          </Link>
          {/* Petit écran : don en icône, pour laisser la place au logo */}
          <Link
            to="/dons"
            aria-label={t('common.donate')}
            className={`flex h-11 w-11 items-center justify-center rounded-full bg-accent text-ink transition sm:hidden ${mobileOpen ? 'invisible' : ''}`}
          >
            <Heart className="h-5 w-5" />
          </Link>
          <button
            ref={burgerRef}
            type="button"
            className={`relative z-50 inline-flex h-11 w-11 items-center justify-center rounded-full transition xl:hidden ${mobileOpen ? 'bg-brand text-white' : 'bg-mist text-ink hover:bg-gray-200'}`}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? t('common.closeMenu') : t('common.menu')}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <Close className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
          </button>
        </div>
      </div>
      <MobileMenu open={mobileOpen} onClose={closeMobile} nav={NAV} burgerRef={burgerRef} />

    </header>
  );
}
