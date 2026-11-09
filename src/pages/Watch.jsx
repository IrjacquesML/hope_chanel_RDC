import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import LivePlayer from '../components/LivePlayer';
import { DonateBanner } from '../components/Sections';
import { getShow, isOnAir, scheduleForDay } from '../lib';
import { useKinshasaClock } from '../hooks/useKinshasaClock';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';
import content from '../data/content.json';

function slotTitle(slot, tr) {
  return (slot.show && getShow(slot.show)?.title) || tr(slot.title) || '';
}

export default function Watch() {
  const { t, tr } = useLang();
  useSeo({ title: t('watch.title'), description: t('watch.intro') });
  const now = useKinshasaClock();
  const today = scheduleForDay(now.dayIndex);
  const currentIdx = today.findIndex((s) => isOnAir(s, now.time));
  const current = today[currentIdx];
  const next = today.slice(currentIdx + 1, currentIdx + 4);

  return (
    <>
      <PageHeader title={t('watch.title')} intro={t('watch.intro')} />
      <section className="container-page grid gap-8 py-12 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!content.live.hidden && <LivePlayer priority />}
          {current && (
            <div className="mt-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-red-700">{t('home.nowOnAir')} · {current.start}–{current.end}</p>
              <h2 className="mt-1 text-2xl font-bold">{slotTitle(current, tr)}</h2>
              {current.show && <p className="mt-2 text-gray-600">{tr(getShow(current.show).description)}</p>}
            </div>
          )}
        </div>

        <aside aria-labelledby="up-next" className="rounded-2xl bg-mist p-6">
          <h2 id="up-next" className="text-lg font-bold">{t('watch.upNext')}</h2>
          <ol className="mt-4 space-y-3">
            {next.map((s) => (
              <li key={s.start} className="flex gap-4 rounded-xl bg-white p-4 shadow-sm">
                <span className="font-heading font-semibold text-brand">{s.start}</span>
                <span className="font-medium">{slotTitle(s, tr)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-gray-600">{t('common.kinshasaTime')}</p>
          <Link to="/programme" className="btn-outline mt-6 w-full">{t('nav.today')}</Link>
        </aside>
      </section>
      <DonateBanner />
    </>
  );
}
