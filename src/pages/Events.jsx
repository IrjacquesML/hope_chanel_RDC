import PageHeader from '../components/PageHeader';
import Img from '../components/Img';
import { Calendar, Clock, MapPin } from '../components/Icons';
import { formatDate } from '../lib';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';
import content from '../data/content.json';

export default function Events() {
  const { t, tr, lang } = useLang();
  useSeo({ title: t('events.title'), description: t('events.intro') });
  const events = [...content.events].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <PageHeader title={t('events.title')} intro={t('events.intro')} />
      <section className="container-page grid gap-6 py-12 md:grid-cols-2">
        {events.map((e) => (
          <article key={e.id} className="card group flex flex-col sm:flex-row">
            <div className="relative aspect-video overflow-hidden sm:aspect-auto sm:w-2/5">
              <Img id={e.image} alt="" className="h-full w-full transition duration-500 group-hover:scale-105" sizes="(min-width: 768px) 20vw, 100vw" />
              <div className="absolute left-3 top-3 rounded-xl bg-white px-3 py-2 text-center shadow">
                <span className="block font-heading text-2xl font-bold leading-none text-brand">{formatDate(e.date, lang, { day: 'numeric' })}</span>
                <span className="block text-xs font-semibold uppercase text-gray-700">{formatDate(e.date, lang, { month: 'short' })}</span>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-6">
              <h2 className="text-xl font-bold">{tr(e.title)}</h2>
              <p className="mt-2 text-sm text-gray-600">{tr(e.summary)}</p>
              <ul className="mt-4 space-y-1.5 text-sm text-gray-700">
                <li className="flex items-center gap-2"><Calendar className="h-4 w-4 text-brand" /><time dateTime={e.date}>{formatDate(e.date, lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</time></li>
                <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-brand" />{e.time}</li>
                <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-brand" />{e.place}</li>
              </ul>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
