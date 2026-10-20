import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, ChevronDown, ChevronRight, Facebook, Film, Globe, Heart, Info, Instagram, Tv, WhatsApp, XIcon, YouTube } from './Icons';
import { useLang } from '../i18n/LanguageContext';
import { useKinshasaClock } from '../hooks/useKinshasaClock';
import { getShow, isOnAir, scheduleForDay } from '../lib';
import content from '../data/content.json';

const ICONS = { watch: Tv, shows: Film, donations: Heart, events: Calendar, about: Info, network: Globe };
const SOCIALS = [
  ['youtube', 'YouTube', YouTube],
  ['facebook', 'Facebook', Facebook],
  ['instagram', 'Instagram', Instagram],
  ['x', 'X', XIcon],
  ['whatsapp', 'WhatsApp', WhatsApp],
];

const samePath = (to, pathname) => to.split(/[?#]/)[0] === pathname;

/**
 * Menu mobile / tablette (< 1280 px).
 * Rendu dans <body> via un portail : un parent avec backdrop-filter (l'en-tête flouté)
 * casserait le positionnement « fixed » du panneau.
 */
export default function MobileMenu({ open, onClose, nav, burgerRef }) {
  const { t, tr, lang, setLang } = useLang();
  const { pathname } = useLocation();
  const panelRef = useRef(null);
  const now = useKinshasaClock();
  const onAir = scheduleForDay(now.dayIndex).find((s) => isOnAir(s, now.time));
  const onAirTitle = onAir ? (onAir.show && getShow(onAir.show)?.title) || tr(onAir.title) : null;

  // Rubrique dépliée par défaut : celle de la page en cours
  const activeParent = nav.find((i) => i.children?.some((c) => samePath(c.to, pathname)))?.key ?? null;
  const [expanded, setExpanded] = useState(activeParent);
  useEffect(() => {
    if (open) setExpanded(activeParent);
  }, [open, activeParent]);

  // Verrouille le défilement, rend le reste de la page inerte, gère Échap et le focus
  useEffect(() => {
    if (!open) return;
    const outside = [document.getElementById('main'), document.querySelector('footer')].filter(Boolean);
    outside.forEach((el) => el.setAttribute('inert', ''));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = panelRef.current?.querySelector('a, button');
    first?.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      // Piège à focus : bouton du menu + éléments du panneau
      const items = [burgerRef.current, ...panelRef.current.querySelectorAll('a[href], button:not([disabled])')].filter(
        (el) => el && el.offsetParent !== null,
      );
      const i = items.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        items.at(-1).focus();
      } else if (!e.shiftKey && i === items.length - 1) {
        e.preventDefault();
        items[0].focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      outside.forEach((el) => el.removeAttribute('inert'));
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      burgerRef.current?.focus({ preventScroll: true });
    };
  }, [open, onClose, burgerRef]);

  const rowCls = (active) =>
    `flex min-h-[56px] w-full items-center gap-4 rounded-xl px-3 text-left font-heading text-[17px] font-semibold transition active:scale-[0.99] ${
      active ? 'bg-brand/5 text-brand' : 'text-ink hover:bg-mist'
    }`;

  return createPortal(
    <div className="xl:hidden" aria-hidden={!open}>
      {/* Voile */}
      <div
        onClick={onClose}
        className={`fixed inset-x-0 bottom-0 top-16 z-40 bg-ink/50 transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      {/* Panneau */}
      <div
        id="mobile-menu"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('common.menu')}
        className={`fixed bottom-0 right-0 top-16 z-40 flex w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-out sm:max-w-md ${
          open ? 'translate-x-0' : 'invisible translate-x-full'
        }`}
      >
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4">
          {/* Raccourci vers le direct */}
          <Link
            to="/regarder"
            onClick={onClose}
            className="mb-4 flex items-center gap-3 rounded-2xl bg-red-600 px-4 py-3.5 text-white shadow-md transition active:scale-[0.99]"
          >
            <span className="live-dot shrink-0 bg-white after:bg-white" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-base font-bold">{t('common.watchLive')}</span>
              {onAirTitle && (
                <span className="block truncate text-sm text-white/85">
                  {t('home.nowOnAir')} · {onAirTitle}
                </span>
              )}
            </span>
            <ChevronRight className="h-5 w-5 shrink-0" />
          </Link>

          <nav aria-label="Navigation mobile">
            <ul className="space-y-1">
              {nav.map((item) => {
                const Icon = ICONS[item.key];
                const iconBox = (active) => (
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-brand text-white' : 'bg-mist text-brand'}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                );
                if (!item.children) {
                  const active = samePath(item.to, pathname) || pathname.startsWith(item.to + '/');
                  return (
                    <li key={item.key}>
                      <Link to={item.to} onClick={onClose} aria-current={active ? 'page' : undefined} className={rowCls(active)}>
                        {iconBox(active)}
                        <span className="flex-1">{t(`nav.${item.key}`)}</span>
                      </Link>
                    </li>
                  );
                }
                const isOpen = expanded === item.key;
                const active = activeParent === item.key;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`m-sub-${item.key}`}
                      onClick={() => setExpanded(isOpen ? null : item.key)}
                      className={rowCls(active)}
                    >
                      {iconBox(active)}
                      <span className="flex-1">{t(`nav.${item.key}`)}</span>
                      <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <div
                      id={`m-sub-${item.key}`}
                      className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                    >
                      <ul className={`min-h-0 overflow-hidden ${isOpen ? '' : 'invisible'}`}>
                        <li className="ml-8 border-l-2 border-gray-100 py-1 pl-4">
                          {item.children.map((c) => {
                            const cActive = samePath(c.to, pathname) && !c.to.includes('?');
                            return (
                              <Link
                                key={c.key}
                                to={c.to}
                                onClick={onClose}
                                aria-current={cActive ? 'page' : undefined}
                                className={`flex min-h-[48px] items-center rounded-lg px-3 text-[15px] transition ${
                                  cActive ? 'bg-accent/15 font-semibold text-ink' : 'text-gray-700 hover:bg-mist hover:text-brand'
                                }`}
                              >
                                {t(`nav.${c.key}`)}
                              </Link>
                            );
                          })}
                        </li>
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ul>
          </nav>

          <ul className="mt-6 flex justify-center gap-2 border-t border-gray-100 pt-6">
            {SOCIALS.map(([key, label, Icon]) => (
              <li key={key}>
                <a
                  href={content.social[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Hope Channel RDC sur ${label}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-mist text-brand transition hover:bg-brand hover:text-white"
                >
                  <Icon />
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Barre d'actions toujours visible */}
        <div className="border-t border-gray-100 bg-white px-4 pt-3 sm:hidden" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center gap-3">
            <div role="group" aria-label={t('common.language')} className="inline-flex shrink-0 rounded-full bg-mist p-1">
              {['fr', 'en'].map((l) => (
                <button
                  key={l}
                  type="button"
                  lang={l}
                  aria-pressed={lang === l}
                  onClick={() => setLang(l)}
                  className={`h-10 min-w-[44px] rounded-full px-3 text-sm font-bold uppercase transition ${lang === l ? 'bg-brand text-white' : 'text-gray-700'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <Link to="/dons" onClick={onClose} className="btn-accent h-12 flex-1 text-base">
              <Heart className="h-5 w-5" />
              {t('common.donate')}
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
