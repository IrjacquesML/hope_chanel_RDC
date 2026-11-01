import { Link } from 'react-router-dom';
import Logo from './Logo';
import { Clock, Lock, Mail, MapPin, Phone } from './Icons';
import { activeSocials } from './Socials';
import { useLang } from '../i18n/LanguageContext';
import content from '../data/content.json';
import { settings, siteName } from '../siteSettings';

function Col({ title, links }) {
  return (
    <div>
      <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-accent">{title}</h2>
      <ul className="mt-3 space-y-0.5">
        {links.map(([label, to]) => (
          <li key={to}>
            <Link to={to} className="inline-flex min-h-[40px] items-center text-white/80 transition hover:text-white hover:underline">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const { t, tr } = useLang();
  const { contact, social } = content;
  const socials = activeSocials(social);
  const about = tr(settings.site?.about) || t('footer.aboutText');
  return (
    <footer className="bg-brand-dark text-white">
      <div className="container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Link to="/" aria-label={`${siteName()} — ${t('common.home')}`} className="inline-block"><Logo onDark /></Link>
          <address className="mt-6 space-y-1 text-sm not-italic text-white/80">
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
        </div>

        <Col
          title={t('footer.explore')}
          links={[
            [t('nav.live'), '/regarder'],
            [t('nav.week'), '/programme?vue=semaine'],
            [t('nav.shows'), '/emissions'],
            [t('nav.events'), '/evenements'],
            [t('common.donate'), '/dons'],
          ]}
        />
        <Col
          title={t('footer.info')}
          links={[
            [t('footer.faq'), '/faq'],
            [t('footer.privacy'), '/confidentialite'],
            [t('footer.terms'), '/conditions'],
            [t('nav.contact'), '/contact'],
          ]}
        />
        <div>
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-accent">{t('footer.about')}</h2>
          <p className="mt-4 text-sm text-white/80">{about}</p>
          <ul className="mt-3 space-y-0.5">
            {[[t('nav.team'), '/apropos#equipe'], [t('nav.news'), '/actualites'], [t('nav.network'), '/reseau']].map(([l, to]) => (
              <li key={to}><Link to={to} className="inline-flex min-h-[40px] items-center text-white/80 hover:text-white hover:underline">{l}</Link></li>
            ))}
          </ul>
          {socials.length > 0 && <p className="mt-6 text-sm font-semibold">{t('footer.follow')}</p>}
          <ul className="mt-3 flex flex-wrap gap-2">
            {socials.map(({ key, label, Icon }) => (
              <li key={key}>
                <a
                  href={social[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${siteName()} — ${label}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 transition hover:-translate-y-0.5 hover:bg-accent hover:text-ink"
                >
                  <Icon />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-5 text-sm text-white/70 sm:flex-row">
          <p>© {new Date().getFullYear()} {settings.site?.copyright || siteName()}. {t('footer.rights')}</p>
          <Link
            to="/admin"
            rel="nofollow"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 ring-1 ring-white/20 transition hover:bg-white/10 hover:text-white sm:min-h-[36px] sm:px-3"
          >
            <Lock className="h-4 w-4" />
            {t('footer.admin')}
          </Link>
        </div>
      </div>
    </footer>
  );
}
