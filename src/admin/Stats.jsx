import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from './api';
import ReportPanel from './ReportPanel';

/* ---------- Formats ---------- */
const nf = new Intl.NumberFormat('fr-FR');
const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
const fmtNum = (n) => (n >= 10_000 ? compact.format(n) : nf.format(n));
function fmtDuration(sec) {
  if (sec < 60) return `${Math.round(sec)} s`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h >= 100 ? `${nf.format(h)} h` : `${h} h ${String(m % 60).padStart(2, '0')}`;
}
/** « 1 vue », « 3 vues » */
const plural = (n, one, many) => `${fmtNum(n)} ${n > 1 ? many : one}`;
const shortDay =(iso) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const longDay = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

const DURATION_STEPS = [60, 120, 300, 600, 900, 1800, 3600, 7200, 3 * 3600, 6 * 3600, 12 * 3600, 86400];

/**
 * Graduations « propres » de l'axe Y.
 * kind 'count' : entiers (0, 1, 2… / 0, 5, 10…) ; kind 'duration' : minutes/heures rondes.
 */
function niceTicks(max, kind = 'count', count = 4) {
  if (max <= 0) return kind === 'duration' ? [0, 60] : [0, 1];
  const raw = max / count;
  let step;
  if (kind === 'duration' && raw <= 86400) step = DURATION_STEPS.find((s) => s >= raw);
  else {
    const pow = 10 ** Math.floor(Math.log10(raw));
    step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw);
    step = Math.max(1, Math.ceil(step)); // jamais de demi-visiteur
  }
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks.at(-1) < max) ticks.push(ticks.at(-1) + step);
  return ticks;
}

/* ---------- Histogramme (une seule série) ---------- */
const fmtAxisDuration = (v) => (v === 0 ? '0' : v >= 3600 ? `${+(v / 3600).toFixed(1)} h` : `${Math.round(v / 60)} min`);

function ColumnChart({ data, kind = 'count', format = fmtNum, height = 220, labelEvery = 1, ariaLabel }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState(null);
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const pad = { top: 12, right: 8, bottom: 26, left: 44 };
  const innerW = Math.max(10, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const ticks = niceTicks(Math.max(...data.map((d) => d.value)), kind);
  const top = ticks.at(-1);
  const band = innerW / data.length;
  const barW = Math.max(2, Math.min(24, band - 2)); // ≤ 24 px, 2 px d'écart entre barres
  const y = (v) => pad.top + innerH - (v / top) * innerH;
  const fmtAxis = kind === 'duration' ? fmtAxisDuration : (v) => compact.format(v);

  return (
    <div ref={wrap} className="relative" onMouseLeave={() => setHover(null)}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="#E5E7EB" strokeWidth="1" />
            <text x={pad.left - 8} y={y(t)} dy="0.35em" textAnchor="end" className="fill-gray-500 text-[11px]">{fmtAxis(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.left + i * band + (band - barW) / 2;
          const h = Math.max(0, y(0) - y(d.value));
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={d.key}>
              {h > 0 && (
                <path
                  d={`M${x},${y(0)} V${y(d.value) + r} Q${x},${y(d.value)} ${x + r},${y(d.value)} H${x + barW - r} Q${x + barW},${y(d.value)} ${x + barW},${y(d.value) + r} V${y(0)} Z`}
                  fill={hover === i ? '#082C5A' : '#0B3C7A'}
                />
              )}
              {/* zone de survol plus large que la barre */}
              <rect x={pad.left + i * band} y={pad.top} width={band} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
              {i % labelEvery === 0 && (
                <text x={pad.left + i * band + band / 2} y={height - 8} textAnchor="middle" className="fill-gray-500 text-[11px]">{d.label}</text>
              )}
            </g>
          );
        })}
        <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} stroke="#D1D5DB" strokeWidth="1" />
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: Math.min(Math.max(pad.left + hover * band + band / 2, 70), width - 70), top: y(data[hover].value) - 8 }}
        >
          <span className="block text-white/70">{data[hover].title}</span>
          <span className="font-semibold">{format(data[hover].value)}</span>
        </div>
      )}
    </div>
  );
}

/* ---------- Petits composants ---------- */
function Delta({ now, before }) {
  if (!before) return <span className="text-xs text-gray-500">{now ? 'nouveau' : '—'}</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  return (
    <span className={`text-xs font-semibold ${up ? 'text-green-700' : 'text-red-700'}`}>
      {up ? '▲' : '▼'} {up ? '+' : ''}{pct} %<span className="font-normal text-gray-500"> vs période préc.</span>
    </span>
  );
}

function Tile({ label, value, delta }) {
  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-black/5">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 font-heading text-3xl font-semibold text-ink">{value}</p>
      <div className="mt-1">{delta}</div>
    </div>
  );
}

function ShareList({ title, rows, labelOf = (k) => k, total }) {
  const max = Math.max(1, ...rows.map((r) => r.visitors));
  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-black/5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-gray-500">Pas encore de données.</p>}
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.key} className="text-sm">
            <div className="flex justify-between gap-3">
              <span className="truncate capitalize">{labelOf(r.key)}</span>
              <span className="shrink-0 tabular-nums text-gray-600">
                {fmtNum(r.visitors)}{total ? ` · ${Math.round((r.visitors / total) * 100)} %` : ''}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-brand/10">
              <div className="h-1.5 rounded-full bg-brand" style={{ width: `${(r.visitors / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const METRICS = [
  ['visitors', 'Visiteurs', fmtNum],
  ['pageviews', 'Pages vues', fmtNum],
  ['plays', 'Lancements de lecture', fmtNum],
  ['watchSeconds', 'Temps regardé', fmtDuration],
];

const PAGE_NAMES = {
  '/': 'Accueil', '/regarder': 'Regarder (direct)', '/programme': 'Programme', '/emissions': 'Émissions', '/episodes': 'Tous les épisodes',
  '/dons': 'Dons', '/dons/reguliers': 'Dons réguliers', '/dons/temoignages': 'Témoignages', '/evenements': 'Événements',
  '/apropos': 'À propos', '/contact': 'Contact', '/actualites': 'Actualités', '/reseau': 'Réseau', '/comment-nous-regarder': 'Comment nous regarder',
};

/* ---------- Page ---------- */
export default function Stats({ data, user }) {
  const [days, setDays] = useState(30);
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState('visitors');

  const load = useCallback(() => {
    api.stats(`days=${days}`).then((r) => { setReport(r); setError(''); }).catch((e) => setError(e.message));
  }, [days]);
  useEffect(() => {
    load();
    const id = setInterval(load, 30_000); // rafraîchit « en direct maintenant »
    return () => clearInterval(id);
  }, [load]);

  const { shows, episodes } = data.shows;
  const contentName = (target) => {
    if (target === 'live') return { title: 'Direct', sub: 'Page Regarder' };
    if (target.startsWith('yt:')) return { title: 'Vidéo YouTube', sub: `Sur nos réseaux · ${target.slice(3)}` };
    const ep = episodes.find((e) => e.id === target);
    if (!ep) return { title: target, sub: 'Épisode supprimé' };
    return { title: ep.title.fr, sub: shows.find((s) => s.slug === ep.show)?.title };
  };
  const pageName = (p) => {
    if (PAGE_NAMES[p]) return PAGE_NAMES[p];
    const m = /^\/emissions\/(.+)$/.exec(p);
    if (m) return `Émission : ${shows.find((s) => s.slug === m[1])?.title || m[1]}`;
    return p;
  };

  if (error) return <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>;
  if (!report) return <p className="text-gray-500">Chargement des statistiques…</p>;

  const { totals: tt, previous: pv } = report;
  const [, metricLabel, metricFmt] = METRICS.find((m) => m[0] === metric);
  const dailyData = report.daily.map((d) => ({ key: d.day, value: d[metric], label: shortDay(d.day), title: longDay(d.day) }));
  const labelEvery = Math.ceil(report.daily.length / 8);
  const empty = tt.pageviews === 0 && tt.plays === 0;
  const totalVisitors = report.devices.reduce((s, r) => s + r.visitors, 0);
  const maxWatch = Math.max(1, ...report.content.map((c) => c.watchSeconds));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Statistiques de visionnage</h1>
          <p className="mt-1 text-sm text-gray-600">
            Du {longDay(report.from)} au {longDay(report.to)} · heure de Kinshasa · mesure anonyme, sans cookie
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Période" className="inline-flex rounded-full bg-white p-1 ring-1 ring-black/10">
            {[[7, '7 j'], [30, '30 j'], [90, '90 j'], [365, '12 mois']].map(([d, l]) => (
              <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${days === d ? 'bg-brand text-white' : 'text-gray-700 hover:bg-mist'}`}>{l}</button>
            ))}
          </div>
          <a href={`/api/stats/export.csv?days=${days}`} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand ring-1 ring-black/10 hover:bg-mist">⬇ Exporter (Excel/CSV)</a>
          <button type="button" aria-expanded={reportOpen} onClick={() => setReportOpen((v) => !v)} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">📄 Rapport PDF</button>
        </div>
      </div>

      {reportOpen && (
        <ReportPanel initialFrom={report.from} initialTo={report.to} user={user} logo={data.settings?.site?.logo} onClose={() => setReportOpen(false)} />
      )}

      <div className="flex items-center gap-3 rounded-xl bg-white p-4 ring-1 ring-black/5">
        <span className={`h-3 w-3 rounded-full ${report.liveNow ? 'animate-pulse bg-red-600' : 'bg-gray-300'}`} aria-hidden="true" />
        <p className="text-sm">
          <strong className="font-heading text-lg">{report.liveNow}</strong> {report.liveNow > 1 ? 'personnes regardent' : 'personne regarde'} le direct sur le site en ce moment
        </p>
      </div>

      {empty && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          Aucune visite enregistrée sur cette période pour l’instant. Les chiffres apparaîtront dès que des visiteurs consulteront le site.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Visiteurs" value={fmtNum(tt.visitors)} delta={<Delta now={tt.visitors} before={pv.visitors} />} />
        <Tile label="Pages vues" value={fmtNum(tt.pageviews)} delta={<Delta now={tt.pageviews} before={pv.pageviews} />} />
        <Tile label="Lancements de lecture" value={fmtNum(tt.plays)} delta={<Delta now={tt.plays} before={pv.plays} />} />
        <Tile label="Temps total regardé" value={fmtDuration(tt.watchSeconds)} delta={<Delta now={tt.watchSeconds} before={pv.watchSeconds} />} />
      </div>
      <p className="-mt-2 text-xs text-gray-500">
        Dont direct : {plural(tt.livePlays, 'lancement', 'lancements')} · {fmtDuration(tt.liveSeconds)} regardé(es)
        {tt.plays > 0 && ` · durée moyenne par lancement : ${fmtDuration(tt.watchSeconds / tt.plays)}`}
      </p>

      <section className="rounded-xl bg-white p-5 ring-1 ring-black/5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">{metricLabel} par jour</h2>
          <select value={metric} onChange={(e) => setMetric(e.target.value)} aria-label="Indicateur" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
            {METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <ColumnChart
          data={dailyData}
          format={metricFmt}
          kind={metric === 'watchSeconds' ? 'duration' : 'count'}
          labelEvery={labelEvery}
          ariaLabel={`${metricLabel} par jour`}
        />
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold text-brand">Voir le tableau des données</summary>
          {/* Défilement vertical uniquement ; libellés abrégés sur téléphone pour tenir en largeur */}
          <div className="mt-2 max-h-72 overflow-y-auto overflow-x-hidden">
            <table className="w-full table-fixed text-left text-xs sm:text-sm">
              <thead className="sticky top-0 bg-white text-[11px] uppercase text-gray-500 sm:text-xs">
                <tr>
                  <th className="w-[30%] py-1">Jour</th>
                  <th><span className="sm:hidden">Visit.</span><span className="hidden sm:inline">Visiteurs</span></th>
                  <th><span className="sm:hidden">Pages</span><span className="hidden sm:inline">Pages vues</span></th>
                  <th><span className="sm:hidden">Lanc.</span><span className="hidden sm:inline">Lancements</span></th>
                  <th><span className="sm:hidden">Temps</span><span className="hidden sm:inline">Temps regardé</span></th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[...report.daily].reverse().map((d) => (
                  <tr key={d.day} className="border-t border-gray-100">
                    <td className="py-1.5">
                      <span className="sm:hidden">{shortDay(d.day)}</span>
                      <span className="hidden sm:inline">{longDay(d.day)}</span>
                    </td>
                    <td>{fmtNum(d.visitors)}</td><td>{fmtNum(d.pageviews)}</td><td>{fmtNum(d.plays)}</td><td>{fmtDuration(d.watchSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="rounded-xl bg-white p-5 ring-1 ring-black/5">
        <h2 className="font-semibold">Contenus les plus regardés</h2>
        <p className="mb-3 text-xs text-gray-500">Classés par temps total regardé. « Spectateurs » = personnes différentes par jour.</p>
        {report.content.length === 0 ? (
          <p className="text-sm text-gray-500">Pas encore de lecture enregistrée.</p>
        ) : (
          // Liste (et non tableau large) : sur téléphone, chaque contenu s'empile sur deux lignes, sans défilement horizontal
          <div>
            <div className="hidden grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_minmax(0,1fr)] gap-4 py-2 text-xs uppercase tracking-wide text-gray-500 md:grid" aria-hidden="true">
              <span>Contenu</span><span className="text-right">Lancements</span><span className="text-right">Spectateurs</span><span>Temps regardé</span>
            </div>
            <ul className="divide-y divide-gray-100">
              {report.content.map((c) => {
                const n = contentName(c.target);
                return (
                  <li key={c.target} className="grid grid-cols-2 gap-x-4 gap-y-1.5 py-3 text-sm md:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_minmax(0,1fr)] md:items-center">
                    <div className="col-span-2 min-w-0 md:col-span-1">
                      <span className="block truncate font-medium">{n.title}</span>
                      <span className="block truncate text-xs text-gray-500">{n.sub}</span>
                    </div>
                    <span className="tabular-nums text-gray-700 md:text-right">
                      {fmtNum(c.plays)}<span className="md:hidden"> {c.plays > 1 ? 'lancements' : 'lancement'}</span>
                    </span>
                    <span className="text-right tabular-nums text-gray-700">
                      {fmtNum(c.viewers)}<span className="md:hidden"> {c.viewers > 1 ? 'spectateurs' : 'spectateur'}</span>
                    </span>
                    <div className="col-span-2 flex items-center gap-3 md:col-span-1">
                      <div className="h-1.5 min-w-0 flex-1 rounded-full bg-brand/10">
                        <div className="h-1.5 rounded-full bg-brand" style={{ width: `${(c.watchSeconds / maxWatch) * 100}%` }} />
                      </div>
                      <span className="w-16 shrink-0 text-right tabular-nums text-gray-700">{fmtDuration(c.watchSeconds)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-xl bg-white p-5 ring-1 ring-black/5">
        <h2 className="font-semibold">À quelle heure regarde-t-on le direct ?</h2>
        <p className="mb-3 text-xs text-gray-500">Temps regardé sur le direct, par heure de la journée (heure de Kinshasa). Utile pour placer les émissions phares.</p>
        <ColumnChart
          data={report.hourly.map((h) => ({ key: h.hour, value: h.watchSeconds, label: `${h.hour}h`, title: `${h.hour}h00 – ${h.hour}h59` }))}
          format={fmtDuration}
          kind="duration"
          labelEvery={3}
          height={180}
          ariaLabel="Temps regardé sur le direct par heure"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl bg-white p-5 ring-1 ring-black/5 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Pages les plus consultées</h2>
          {report.pages.length === 0 && <p className="text-sm text-gray-500">Pas encore de données.</p>}
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {report.pages.map((p) => (
                <tr key={p.path}>
                  <td className="py-2">{pageName(p.path)}</td>
                  <td className="text-right tabular-nums text-gray-600">{plural(p.views, 'vue', 'vues')}</td>
                  <td className="hidden w-32 text-right tabular-nums text-gray-500 sm:table-cell">{plural(p.visitors, 'visiteur', 'visiteurs')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <ShareList title="D’où viennent les visiteurs" rows={report.sources} labelOf={(k) => (k === 'direct' ? 'Accès direct / favoris' : k)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ShareList title="Appareils" rows={report.devices} total={totalVisitors} />
        <ShareList title="Langue du site" rows={report.langs} labelOf={(k) => ({ fr: 'Français', en: 'Anglais' }[k] || k)} total={report.langs.reduce((s, r) => s + r.visitors, 0)} />
      </div>
    </div>
  );
}
