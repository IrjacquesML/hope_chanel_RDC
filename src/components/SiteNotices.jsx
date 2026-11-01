import { useState } from 'react';
import Logo from './Logo';
import { Close, Mail, Phone } from './Icons';
import { useLang } from '../i18n/LanguageContext';
import content from '../data/content.json';
import { settings } from '../siteSettings';

const TONES = {
  info: 'bg-brand text-white',
  success: 'bg-green-700 text-white',
  warning: 'bg-accent text-ink',
  urgent: 'bg-red-700 text-white',
};

/** Bandeau d'annonce en haut du site (Paramètres → Annonce & maintenance). Fermé : masqué jusqu'à un nouveau texte. */
export function AnnouncementBar() {
  const { t, tr } = useLang();
  const { enabled, text, link, tone } = settings.announcement || {};
  const message = enabled ? tr(text)?.trim() : '';
  const storageKey = `hc-announce-${message}`;
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });
  if (!message || hidden) return null;
  const close = () => {
    setHidden(true);
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      /* stockage indisponible */
    }
  };
  const external = /^https?:/.test(link || '');
  return (
    <div role="region" aria-label="Annonce" className={TONES[tone] || TONES.info}>
      <div className="container-page flex items-center gap-3 py-2 text-sm">
        <p className="flex-1 text-center font-medium">
          {link ? (
            <a href={link} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="underline underline-offset-2 hover:no-underline">
              {message}
            </a>
          ) : (
            message
          )}
        </p>
        <button type="button" onClick={close} aria-label={t('common.dismiss')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-black/10">
          <Close className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Page affichée aux visiteurs quand le mode maintenance est actif. */
export function MaintenancePage() {
  const { t, tr } = useLang();
  const { contact } = content;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-mist p-6 text-center">
      <Logo />
      <h1 className="mt-10 text-3xl font-bold">{t('common.maintenanceTitle')}</h1>
      <p className="mt-4 max-w-lg text-gray-700">{tr(settings.maintenance?.message)}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-700">
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2 hover:text-brand"><Mail className="h-4 w-4" />{contact.email}</a>
        )}
        {contact.phones[0] && (
          <a href={`tel:${contact.phones[0].replace(/\s/g, '')}`} className="inline-flex items-center gap-2 hover:text-brand"><Phone className="h-4 w-4" />{contact.phones[0]}</a>
        )}
      </div>
    </main>
  );
}

/** Rappel affiché à l'administrateur connecté, qui continue de voir le site pendant la maintenance. */
export function MaintenanceAdminNotice() {
  const { t } = useLang();
  return (
    <div role="status" className="bg-amber-100 py-2 text-center text-sm font-medium text-amber-900">
      {t('common.maintenanceAdmin')} <a href="/admin/settings" className="underline">Paramètres</a>
    </div>
  );
}
