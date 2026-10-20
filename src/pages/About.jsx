import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Img from '../components/Img';
import SectionTitle from '../components/SectionTitle';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';
import content from '../data/content.json';

export default function About() {
  const { t, tr } = useLang();
  useSeo({ title: t('nav.about'), description: t('about.intro') });

  return (
    <>
      <PageHeader title={t('about.title')} intro={t('about.intro')} />

      <section className="container-page grid items-center gap-10 py-14 lg:grid-cols-2">
        <div>
          <SectionTitle title={t('about.missionTitle')} />
          <p className="text-lg leading-relaxed text-gray-700">{t('about.mission')}</p>
          <dl className="mt-8 grid grid-cols-3 gap-4">
            {t('about.stats').map((s) => (
              <div key={s.label} className="flex flex-col rounded-2xl bg-mist p-4 text-center">
                <dt className="order-2 mt-1 text-xs text-gray-600 sm:text-sm">{s.label}</dt>
                <dd className="font-heading text-2xl font-bold text-brand sm:text-3xl">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Img id="photo-1478737270239-2f02b77fc618" alt="" className="aspect-[4/3] w-full rounded-3xl shadow-xl" ratio={4 / 3} sizes="(min-width: 1024px) 50vw, 100vw" />
      </section>

      <section aria-labelledby="values" className="bg-mist py-14">
        <div className="container-page">
          <SectionTitle id="values" title={t('about.valuesTitle')} />
          <ul className="grid gap-5 md:grid-cols-3">
            {t('about.values').map((v) => (
              <li key={v.title} className="card p-6">
                <h3 className="text-xl font-semibold text-brand">{v.title}</h3>
                <p className="mt-2 text-gray-700">{v.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="equipe" aria-labelledby="team" className="container-page scroll-mt-24 py-14">
        <SectionTitle id="team" title={t('about.teamTitle')} />
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {content.team.map((m) => (
            <li key={m.name} className="card group text-center">
              <div className="aspect-square overflow-hidden">
                <Img id={m.image} alt={m.name} ratio={1} width={500} className="h-full w-full transition duration-500 group-hover:scale-105" sizes="(min-width: 1024px) 25vw, 50vw" />
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold">{m.name}</h3>
                <p className="text-sm text-gray-600">{tr(m.role)}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/contact" className="btn-primary">{t('nav.contact')}</Link>
          <Link to="/actualites" className="btn-outline">{t('nav.news')}</Link>
        </div>
      </section>
    </>
  );
}
