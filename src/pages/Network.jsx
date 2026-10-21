import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { MapPin } from '../components/Icons';
import { HowToWatch } from '../components/Sections';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';
import content from '../data/content.json';

export default function Network() {
  const { t, tr } = useLang();
  useSeo({ title: t('network.title'), description: t('network.intro') });
  return (
    <>
      <PageHeader title={t('network.title')} intro={t('network.intro')} />
      <section className="container-page py-12">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {content.network.map((n) => (
            <li key={n.city} className="card flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><MapPin /></span>
              <span>
                <span className="block font-heading text-lg font-semibold">{n.city}</span>
                <span className="text-sm text-gray-600">{tr(n.channel)}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-col items-start gap-4 rounded-3xl bg-mist p-6 sm:flex-row sm:p-8 sm:items-center sm:justify-between">
          <p className="font-heading text-lg font-semibold">{t('network.partner')}</p>
          <Link to="/contact" className="btn-primary">{t('network.partnerCta')}</Link>
        </div>
      </section>
      <HowToWatch />
    </>
  );
}
