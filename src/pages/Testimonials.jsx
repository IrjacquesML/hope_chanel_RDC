import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { DonateBanner } from '../components/Sections';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';
import content from '../data/content.json';

export default function Testimonials() {
  const { t, tr } = useLang();
  useSeo({ title: t('donate.testimonialsTitle'), description: t('donate.testimonialsIntro') });
  return (
    <>
      <PageHeader title={t('donate.testimonialsTitle')} intro={t('donate.testimonialsIntro')} />
      {content.testimonials.length === 0 && <div className="container-page py-12"><EmptyState /></div>}
      <section className={`container-page grid gap-6 py-12 md:grid-cols-3 ${content.testimonials.length ? '' : 'hidden'}`}>
        {content.testimonials.map((x) => (
          <figure key={x.name} className="card flex flex-col p-6 sm:p-8">
            <span aria-hidden="true" className="font-heading text-6xl leading-none text-accent">“</span>
            <blockquote className="mt-2 flex-1 text-gray-800">{tr(x.text)}</blockquote>
            <figcaption className="mt-6 font-heading font-semibold text-brand">{x.name}</figcaption>
          </figure>
        ))}
      </section>
      <DonateBanner />
    </>
  );
}
