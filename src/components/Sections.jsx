import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Globe, Heart, Radio, Smartphone, Tv, YouTube } from './Icons';
import SectionTitle from './SectionTitle';
import { useLang } from '../i18n/LanguageContext';

const WAYS = [
  { key: 'tv', Icon: Tv },
  { key: 'mobile', Icon: Smartphone },
  { key: 'youtube', Icon: YouTube },
  { key: 'radio', Icon: Radio },
  { key: 'web', Icon: Globe },
];

export function HowToWatch({ asPageSection = false }) {
  const { t } = useLang();
  return (
    <section aria-labelledby="how-title" className="bg-mist py-16">
      <div className="container-page">
        {!asPageSection && <SectionTitle id="how-title" title={t('home.howTitle')} subtitle={t('home.howSub')} />}
        {asPageSection && <h2 id="how-title" className="sr-only">{t('home.howTitle')}</h2>}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {WAYS.map(({ key, Icon }) => (
            <li key={key} className="card p-6 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <Icon className="h-7 w-7" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{t(`how.${key}.title`)}</h3>
              <p className="mt-2 text-sm text-gray-600">{t(`how.${key}.text`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function DonateBanner() {
  const { t } = useLang();
  return (
    <section aria-labelledby="donate-banner" className="py-16">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-dark px-6 py-12 text-white sm:px-12 sm:py-16">
          <svg aria-hidden="true" viewBox="0 0 200 100" className="absolute -bottom-6 -right-6 w-72 opacity-20 sm:w-96">
            <path d="M40 100a60 60 0 0 1 120 0z" fill="#F59E0B" />
            <g stroke="#F59E0B" strokeWidth="6" strokeLinecap="round">
              <path d="M100 10v18M45 32l12 12M155 32l-12 12M15 75h18M167 75h18" />
            </g>
          </svg>
          <div className="relative max-w-2xl">
            <h2 id="donate-banner" className="text-3xl font-bold text-white sm:text-4xl">{t('home.donateTitle')}</h2>
            <p className="mt-4 text-lg text-white/85">{t('home.donateText')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/dons" className="btn-accent px-7 py-3 text-base">
                <Heart className="h-5 w-5" />
                {t('common.donate')}
              </Link>
              <Link to="/dons/reguliers" className="btn-ghost-light px-7 py-3 text-base">{t('nav.regular')}</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Newsletter() {
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('common.invalidEmail'));
      return;
    }
    setError('');
    setDone(true); // TODO : brancher sur le service d'e-mailing
  };

  return (
    <section aria-labelledby="newsletter-title" className="py-16">
      <div className="container-page">
        <div className="mx-auto max-w-3xl rounded-3xl bg-mist p-8 text-center sm:p-12">
          <h2 id="newsletter-title" className="text-2xl font-bold sm:text-3xl">{t('home.newsletterTitle')}</h2>
          <p className="mx-auto mt-3 max-w-xl text-gray-600">{t('home.newsletterText')}</p>
          {done ? (
            <p role="status" className="mt-6 inline-flex items-center gap-2 rounded-full bg-green-100 px-5 py-3 font-medium text-green-800">
              <Check /> {t('home.newsletterOk')}
            </p>
          ) : (
            <form onSubmit={submit} noValidate className="mx-auto mt-6 flex max-w-lg flex-col gap-3 sm:flex-row">
              <label htmlFor="nl-email" className="sr-only">{t('home.newsletterPlaceholder')}</label>
              <input
                id="nl-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('home.newsletterPlaceholder')}
                aria-invalid={!!error}
                aria-describedby={error ? 'nl-error' : undefined}
                className="input flex-1"
              />
              <button type="submit" className="btn-primary px-6 py-3">{t('home.newsletterButton')}</button>
            </form>
          )}
          {error && <p id="nl-error" role="alert" className="error-text">{error}</p>}
        </div>
      </div>
    </section>
  );
}
