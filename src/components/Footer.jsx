import { Link } from 'react-router-dom';
import Logo from './Logo';
import { Clock, Mail, MapPin, Phone } from './Icons';
import { activeSocials } from './Socials';
import { useLang } from '../i18n/LanguageContext';
import content from '../data/content.json';
import { settings, siteName } from '../siteSettings';

const title = 'font-heading text-sm font-semibold uppercase tracking-wider text-accent';
const link = 'inline-flex min-h-[40px] items-center text-white/80 transition hover:text-white hover:underline';

/** Pied de page volontairement sobre : coordonnées, à propos, partenaires. */
export default function Footer() {
  const { t, tr } = useLang();
  const { contact, social } = content;
  const socials = activeSocials(social);
  const partners = (content.partners || []).filter((p) => p.name?.trim() && p.url?.trim());
  const about = tr(settings.site?.about) || t('footer.aboutText');
  return (
    <footer className="bg-brand-dark text-white">
      <div className={`container-page grid gap-10 py-14 md:grid-cols-2 ${partners.length ? 'lg:grid-cols-3' : ''}`}>
        <div>
          <Link to="/" aria-label={`${siteName()} — ${t('common.home')}`} className="inline-block"><Logo onDark /></Link>
          <h2 className={`${title} mt-6`}>{t('footer.contact')}</h2>
          <address className="mt-3 space-y-1 text-sm not-italic text-white/80">
            {contact.address && <p className="flex gap-2 pb-1"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{contact.address}</p>}
            {contact.phones.map((p) => (
              <p key={p} className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-accent" />
                <a href={`tel:${p.replace(/\s/g, '')}`} className="inline-flex min-h-[40px] items-center hover:text-white">{p}</a>
              </p>
            ))}
            {contact.email && (
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-accent" />
                <a href={`mailto:${contact.email}`} className="inline-flex min-h-[40px] items-center break-all hover:text-white">{contact.email}</a>
              </p>
            )}
            {tr(contact.hours) && <p className="flex gap-2 pt-1"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{tr(contact.hours)}</p>}
          </address>
          {socials.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label={t('footer.follow')}>
              {socials.map(({ key, label, Icon }) => (
                <li key={key}>
                  <a
                    href={social[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${siteName()} — ${label}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:-translate-y-0.5 hover:bg-accent hover:text-ink"
                  >
                    <Icon />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className={title}>{t('footer.about')}</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/80">{about}</p>
          <Link to="/apropos" className={`${link} text-sm font-semibold text-white`}>{t('footer.more')} →</Link>
        </div>

        {partners.length > 0 && (
          <div>
            <h2 className={title}>{t('footer.partners')}</h2>
            <ul className="mt-3 space-y-0.5 text-sm">
              {partners.map((p) => (
                <li key={`${p.name}-${p.url}`}>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className={link}>{p.name}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-sm text-white/70 sm:flex-row">
          <p>© {new Date().getFullYear()} {settings.site?.copyright || siteName()}. {t('footer.rights')}</p>
          <p className="flex gap-4">
            <Link to="/confidentialite" className="hover:text-white hover:underline">{t('footer.privacy')}</Link>
            <Link to="/conditions" className="hover:text-white hover:underline">{t('footer.terms')}</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
