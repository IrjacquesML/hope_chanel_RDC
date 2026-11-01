import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { HowToWatch, Newsletter } from '../components/Sections';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';
import content from '../data/content.json';

const DEFAULT_EMAIL = 'hopechannelrdc@gmail.com';
/** Les textes modèles citent l'e-mail par défaut : on affiche celui défini dans l'administration. */
const withEmail = (text) => text.replace(DEFAULT_EMAIL, content.contact.email || DEFAULT_EMAIL);

export function HowToWatchPage() {
  const { t } = useLang();
  useSeo({ title: t('nav.howToWatch'), description: t('home.howSub') });
  return (
    <>
      <PageHeader title={t('home.howTitle')} intro={t('home.howSub')} />
      <HowToWatch asPageSection />
      <Newsletter />
    </>
  );
}

/* Pages légales : textes modèles à faire valider juridiquement. */
const LEGAL = {
  privacy: {
    titleKey: 'legal.privacyTitle',
    fr: [
      ['Données collectées', "Nous collectons uniquement les données que vous nous transmettez volontairement (formulaire de contact, newsletter, dons) : nom, adresse e-mail, numéro de téléphone."],
      ['Utilisation', "Ces données servent exclusivement à répondre à vos demandes, à vous envoyer notre lettre d'information et à traiter vos dons. Elles ne sont jamais vendues."],
      ['Paiements', "Les paiements Mobile Money et carte sont traités par des prestataires certifiés. Hope Chanel RDC ne conserve aucune donnée de carte bancaire."],
      ['Vos droits', 'Vous pouvez demander l’accès, la rectification ou la suppression de vos données en écrivant à hopechannelrdc@gmail.com.'],
    ],
    en: [
      ['Data collected', 'We only collect data you voluntarily provide (contact form, newsletter, donations): name, email address, phone number.'],
      ['Use', 'This data is used solely to answer your requests, send our newsletter and process your gifts. It is never sold.'],
      ['Payments', 'Mobile Money and card payments are processed by certified providers. Hope Chanel RDC stores no card data.'],
      ['Your rights', 'You may request access, correction or deletion of your data by writing to hopechannelrdc@gmail.com.'],
    ],
  },
  terms: {
    titleKey: 'legal.termsTitle',
    fr: [
      ['Objet', "Les présentes conditions régissent l'utilisation du site Hope Chanel RDC et de ses services de diffusion en ligne."],
      ['Propriété intellectuelle', "Les émissions, textes, logos et visuels sont la propriété de Hope Chanel RDC ou de leurs auteurs. Toute reproduction sans autorisation est interdite."],
      ['Responsabilité', "Nous faisons notre possible pour assurer la disponibilité du direct, sans pouvoir garantir une diffusion ininterrompue."],
    ],
    en: [
      ['Purpose', 'These terms govern the use of the Hope Chanel RDC website and its online streaming services.'],
      ['Intellectual property', 'Shows, texts, logos and visuals belong to Hope Chanel RDC or their authors. Reproduction without permission is prohibited.'],
      ['Liability', 'We do our best to keep the live stream available but cannot guarantee uninterrupted broadcast.'],
    ],
  },
  faq: {
    titleKey: 'legal.faqTitle',
    fr: [
      ['La chaîne est-elle gratuite ?', 'Oui. Hope Chanel RDC est gratuite sur la TNT, le satellite, le web et l’application, grâce aux dons de nos téléspectateurs.'],
      ['Comment recevoir la chaîne ?', 'Consultez la page « Comment nous regarder » et la page « Réseau » pour les fréquences de votre ville.'],
      ['Mon don est-il sécurisé ?', 'Les paiements sont confiés à des prestataires agréés ; aucune donnée bancaire n’est stockée par la chaîne.'],
    ],
    en: [
      ['Is the channel free?', 'Yes. Hope Chanel RDC is free on DTT, satellite, web and app, thanks to our viewers’ gifts.'],
      ['How can I receive the channel?', 'See the “How to watch” and “Network” pages for frequencies in your city.'],
      ['Is my gift secure?', 'Payments are handled by licensed providers; no bank data is stored by the channel.'],
    ],
  },
};

export function LegalPage({ kind }) {
  const { t, lang } = useLang();
  const page = LEGAL[kind];
  useSeo({ title: t(page.titleKey) });
  return (
    <>
      <PageHeader title={t(page.titleKey)} />
      <section className="container-page max-w-3xl py-12">
        <p className="mb-8 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">{t('legal.placeholder')}</p>
        {kind === 'faq' ? (
          <div className="space-y-3">
            {page[lang].map(([q, a]) => (
              <details key={q} className="group rounded-2xl bg-mist p-5 open:bg-white open:shadow-sm open:ring-1 open:ring-black/5">
                <summary className="cursor-pointer list-none font-heading font-semibold marker:hidden">
                  <span className="mr-2 inline-block text-accent-dark transition group-open:rotate-45">+</span>{q}
                </summary>
                <p className="mt-3 text-gray-700">{a}</p>
              </details>
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {page[lang].map(([h, p]) => (
              <div key={h}>
                <h2 className="text-xl font-bold">{h}</h2>
                <p className="mt-2 leading-relaxed text-gray-700">{withEmail(p)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export function NotFoundPage() {
  const { t } = useLang();
  useSeo({ title: t('common.notFound') });
  return (
    <section className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-heading text-7xl font-bold text-accent">404</p>
      <h1 className="mt-4 text-3xl font-bold">{t('common.notFound')}</h1>
      <p className="mt-3 text-gray-600">{t('common.notFoundText')}</p>
      <Link to="/" className="btn-primary mt-8">{t('common.home')}</Link>
    </section>
  );
}
