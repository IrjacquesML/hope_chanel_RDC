import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { Clock } from '../components/Icons';
import { getShow, isOnAir, scheduleForDay } from '../lib';
import { useKinshasaClock } from '../hooks/useKinshasaClock';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';

function SlotRow({ slot, onAir }) {
  const { t, tr } = useLang();
  const show = slot.show && getShow(slot.show);
  return (
    <li
      aria-current={onAir ? 'true' : undefined}
      className={`flex items-start gap-4 rounded-xl p-4 transition ${onAir ? 'bg-brand text-white shadow-lg' : 'bg-white hover:bg-mist'}`}
    >
      <span className={`w-28 shrink-0 whitespace-nowrap font-heading font-semibold ${onAir ? 'text-accent' : 'text-brand'}`}>
        {slot.start}<span className="sr-only"> – </span><span aria-hidden="true">–</span>{slot.end === '23:59' ? '00:00' : slot.end}
      </span>
      <span className="flex-1">
        {show ? (
          <Link to={`/emissions/${show.slug}`} className={`font-semibold hover:underline ${onAir ? 'text-white' : 'text-ink'}`}>{show.title}</Link>
        ) : (
          <span className="font-semibold">{tr(slot.title)}</span>
        )}
        {show && <span className={`block text-sm ${onAir ? 'text-white/80' : 'text-gray-600'}`}>{t(`categories.${show.category}`)}</span>}
      </span>
      {onAir && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold uppercase text-white">
          <span className="live-dot bg-white after:bg-white" aria-hidden="true" />{t('schedule.now')}
        </span>
      )}
      {!onAir && slot.live && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold uppercase text-red-700">{t('common.live')}</span>}
    </li>
  );
}

export default function Schedule() {
  const { t } = useLang();
  const [params, setParams] = useSearchParams();
  const view = params.get('vue') === 'semaine' ? 'week' : 'today';
  const now = useKinshasaClock();
  const days = t('schedule.days');
  const selectedDay = params.has('jour') ? Number(params.get('jour')) : now.dayIndex;
  useSeo({ title: t('schedule.title'), description: t('schedule.intro') });

  const setView = (v) => setParams(v === 'week' ? { vue: 'semaine' } : {});

  return (
    <>
      <PageHeader title={t('schedule.title')} intro={t('schedule.intro')}>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm">
          <Clock className="h-4 w-4 text-accent" /> {t('common.kinshasaTime')} — {days[now.dayIndex]} {now.time}
        </p>
      </PageHeader>

      <section className="container-page py-10">
        <div role="tablist" aria-label={t('schedule.title')} className="inline-flex rounded-full bg-mist p-1">
          {[['today', t('schedule.today')], ['week', t('schedule.week')]].map(([v, label]) => (
            <button
              key={v}
              role="tab"
              type="button"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-full px-5 py-2 font-heading text-sm font-semibold transition ${view === v ? 'bg-brand text-white shadow' : 'text-gray-700 hover:text-brand'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {view === 'today' ? (
          <div className="mt-8 max-w-3xl">
            <h2 className="text-2xl font-bold">{days[now.dayIndex]}</h2>
            <ol className="mt-4 space-y-2">
              {scheduleForDay(now.dayIndex).map((s) => <SlotRow key={s.start} slot={s} onAir={isOnAir(s, now.time)} />)}
            </ol>
          </div>
        ) : (
          <div className="mt-8">
            <div className="-mx-4 overflow-x-auto px-4 pb-2">
              <div className="flex gap-2" role="group" aria-label={t('nav.week')}>
                {days.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={selectedDay === i}
                    onClick={() => setParams({ vue: 'semaine', jour: String(i) })}
                    className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${selectedDay === i ? 'bg-accent text-ink' : 'bg-mist text-gray-700 hover:bg-gray-200'}`}
                  >
                    {d}
                    {i === now.dayIndex && <span className="ml-1 text-xs font-normal">({t('schedule.today').toLowerCase()})</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-6 max-w-3xl">
              <h2 className="text-2xl font-bold">{days[selectedDay]}</h2>
              <ol className="mt-4 space-y-2">
                {scheduleForDay(selectedDay).map((s) => (
                  <SlotRow key={s.start} slot={s} onAir={selectedDay === now.dayIndex && isOnAir(s, now.time)} />
                ))}
              </ol>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
