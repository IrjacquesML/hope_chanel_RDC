// Rapports d'audience au format PDF (synthèse, visites, visionnage), avec en-tête au logo et signature du directeur.
import PDFDocument from 'pdfkit';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_LOGO = path.join(ROOT, 'public', 'logo-hope-channel-rdc-original.jpg');

const A4 = { w: 595.28, h: 841.89 };
const M = { left: 50, right: 50, top: 118, bottom: 62 };
const W = A4.w - M.left - M.right;
const GRAY = '#4B5563';
const LIGHT = '#6B7280';
const LINE = '#E5E7EB';
const ZEBRA = '#F5F7FB';

const PAGE_NAMES = {
  '/': 'Accueil', '/regarder': 'Regarder (direct)', '/programme': 'Programme', '/emissions': 'Émissions', '/episodes': 'Tous les épisodes',
  '/dons': 'Dons', '/dons/reguliers': 'Dons réguliers', '/dons/temoignages': 'Témoignages', '/evenements': 'Événements',
  '/apropos': 'À propos', '/contact': 'Contact', '/actualites': 'Actualités', '/reseau': 'Réseau', '/comment-nous-regarder': 'Comment nous regarder',
  '/sur-nos-reseaux': 'Sur nos réseaux',
};
const SOURCE_NAMES = { direct: 'Accès direct / favoris', whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram', x: 'X (Twitter)', youtube: 'YouTube', google: 'Google' };
const DEVICE_NAMES = { mobile: 'Téléphone mobile', tablette: 'Tablette', ordinateur: 'Ordinateur' };
const LANG_NAMES = { fr: 'Français', en: 'Anglais' };

/* ---------- Formats ---------- */
// Les polices standard du PDF n'ont que le jeu WinAnsi : on remplace les espaces fines et on retire les caractères absents.
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const clean = (s) =>
  String(s ?? '')
    .replace(/[   ]/g, ' ')
    .replace(/−/g, '-')
    .replace(/[^\n\x20-\xff]/g, (c) => (WIN_ANSI_EXTRA.includes(c) ? c : ''));
const nf = new Intl.NumberFormat('fr-FR');
const num = (n) => nf.format(Math.round(n || 0));
const pct = (part, total) => (total ? `${Math.round((part / total) * 100)} %` : '—');
function duration(sec) {
  sec = Math.round(sec || 0);
  if (sec < 60) return `${sec} s`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${num(h)} h ${String(m % 60).padStart(2, '0')}`;
}
const dateLong = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dateShort = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const dayLabel = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const monthLabel = (ym) => new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
function evolution(now, before) {
  if (!before) return now ? 'nouveau' : '—';
  const p = Math.round(((now - before) / before) * 100);
  return `${p >= 0 ? '+' : ''}${p} %`;
}

/** Haut de l'axe Y arrondi pour des graduations lisibles (quarts « ronds »). */
const DURATION_STEPS = [15, 30, 60, 300, 600, 900, 1800, 3600, 7200, 3 * 3600, 6 * 3600, 12 * 3600, 86400];
function niceTop(max, isDuration) {
  if (max <= 0) return isDuration ? 240 : 4;
  const raw = max / 4;
  let step = isDuration && raw <= 86400 ? DURATION_STEPS.find((v) => v >= raw) : null;
  if (!step) {
    const pow = 10 ** Math.floor(Math.log10(raw));
    step = Math.max(1, [1, 2, 2.5, 5, 10].map((k) => k * pow).find((v) => v >= raw));
  }
  return 4 * step; // step >= max / 4, donc le haut de l'axe couvre toujours le maximum
}

/** Image envoyée par l'administration (data URL PNG / JPEG) -> Buffer, ou null. */
export function imageBuffer(dataUrl) {
  const m = /^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(typeof dataUrl === 'string' ? dataUrl : '');
  if (!m) return null;
  const buf = Buffer.from(m[1], 'base64');
  return buf.length > 0 && buf.length <= 4 * 1024 * 1024 ? buf : null;
}

/** Logo de secours lu sur le disque : celui des paramètres s'il est en PNG/JPEG, sinon le logo d'origine. */
function diskLogo(settings) {
  const url = settings?.site?.logo || '';
  if (/^\/[\w./-]+\.(png|jpe?g)$/i.test(url) && !url.includes('..')) {
    const file = url.startsWith('/uploads/') ? path.join(ROOT, url) : path.join(ROOT, 'public', url);
    if (existsSync(file)) return readFileSync(file);
  }
  return existsSync(DEFAULT_LOGO) ? readFileSync(DEFAULT_LOGO) : null;
}

/* ---------- Document ---------- */
export function buildStatsPdf(r, { kind, settings, contact = {}, shows = [], episodes = [], videoTitle = () => '', signer, logo, signature, author }) {
  const brand = settings?.appearance?.brand || '#0B3C7A';
  const accent = settings?.appearance?.accent || '#F59E0B';
  const siteName = clean(settings?.site?.name || 'Hope Channel RDC');
  const siteUrl = clean((settings?.site?.url || '').replace(/^https?:\/\//, ''));
  const logoBuf = logo || diskLogo(settings);
  const nowParts = new Date(Date.now() + 3600_000); // heure de Kinshasa
  const today = nowParts.toISOString().slice(0, 10);
  const nowTime = nowParts.toISOString().slice(11, 16).replace(':', ' h ');
  const TITLES = { full: 'Rapport d’audience complet', views: 'Rapport de visionnage', visits: 'Rapport des visites du site' };
  const title = TITLES[kind];

  const doc = new PDFDocument({
    size: 'A4',
    margins: M,
    bufferPages: true,
    info: { Title: clean(`${title} — ${siteName} — ${dateShort(r.from)} au ${dateShort(r.to)}`), Author: siteName, Creator: siteName, Subject: 'Statistiques d’audience du site' },
  });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const text = (s, x, y, opts) => doc.text(clean(s), x, y, opts);

  /* En-tête de chaque page : logo, coordonnées, filet aux couleurs de la chaîne */
  function header() {
    const y0 = 34;
    let logoW = 0;
    if (logoBuf) {
      try {
        const img = doc.openImage(logoBuf);
        const h = 46;
        logoW = Math.min(250, (img.width / img.height) * h);
        doc.image(img, M.left, y0, { fit: [logoW, h] });
      } catch {
        logoW = 0;
      }
    }
    if (!logoW) {
      doc.font('Helvetica-Bold').fontSize(18).fillColor(brand);
      text(siteName, M.left, y0 + 12, { lineBreak: false });
    }
    const lines = [contact.address, [contact.phones?.[0], contact.email].filter(Boolean).join('  ·  '), siteUrl].filter(Boolean);
    const boxX = M.left + Math.max(logoW, 160) + 16;
    doc.font('Helvetica').fontSize(7.5).fillColor(GRAY);
    text(lines.join('\n'), boxX, y0 + 2, { width: A4.w - M.right - boxX, align: 'right', lineGap: 1.5 });
    doc.rect(M.left, 92, W, 2.2).fill(brand);
    doc.rect(M.left, 94.2, W * 0.28, 2.2).fill(accent);
    doc.x = M.left;
    doc.y = M.top;
  }
  doc.on('pageAdded', header);
  header();

  const space = (h) => {
    if (doc.y + h > A4.h - M.bottom) doc.addPage();
  };

  /* Titres */
  let sectionNo = 0;
  function section(label, intro) {
    space(80);
    doc.moveDown(0.6);
    sectionNo += 1;
    const y = doc.y;
    doc.rect(M.left, y, 4, 16).fill(accent);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(brand);
    text(`${sectionNo}. ${label}`, M.left + 12, y + 2, { width: W - 12 });
    doc.moveDown(0.3);
    if (intro) {
      doc.font('Helvetica').fontSize(8.5).fillColor(LIGHT);
      text(intro, M.left, doc.y, { width: W });
    }
    doc.moveDown(0.6);
  }
  function subTitle(label, need = 100) {
    space(need); // jamais un intertitre seul en bas de page (need : place de l'intertitre et de ce qui suit)
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827');
    text(label, M.left, doc.y, { width: W });
    doc.moveDown(0.35);
  }
  function note(s) {
    doc.font('Helvetica').fontSize(8).fillColor(LIGHT);
    text(s, M.left, doc.y, { width: W });
    doc.moveDown(0.4);
  }

  /* Tableau : colonnes { label, width (fraction), align }, en-tête répété après un saut de page */
  function table(cols, rows, { empty = 'Aucune donnée sur cette période.', total } = {}) {
    if (!rows.length) {
      note(empty);
      return;
    }
    const widths = cols.map((c) => c.width * W);
    const pad = 5;
    const drawHead = () => {
      const y = doc.y;
      doc.rect(M.left, y, W, 18).fill(brand);
      doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#FFFFFF');
      let x = M.left;
      cols.forEach((c, i) => {
        text(c.label, x + pad, y + 5.5, { width: widths[i] - 2 * pad, align: c.align || 'left', lineBreak: false, ellipsis: true });
        x += widths[i];
      });
      doc.y = y + 18;
    };
    const drawRow = (cells, i, bold) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.2);
      const h = Math.max(16, ...cells.map((c, j) => doc.heightOfString(clean(c), { width: widths[j] - 2 * pad }) + 8));
      if (doc.y + h > A4.h - M.bottom) {
        doc.addPage();
        drawHead();
      }
      const y = doc.y;
      if (bold) doc.rect(M.left, y, W, h).fill('#E8EEF7');
      else if (i % 2) doc.rect(M.left, y, W, h).fill(ZEBRA);
      doc.fillColor('#111827').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.2);
      let x = M.left;
      cells.forEach((c, j) => {
        text(c, x + pad, y + 4.5, { width: widths[j] - 2 * pad, align: cols[j].align || 'left' });
        x += widths[j];
      });
      doc.moveTo(M.left, y + h).lineTo(M.left + W, y + h).lineWidth(0.4).strokeColor(LINE).stroke();
      doc.y = y + h;
    };
    space(18 + 16 * Math.min(rows.length, 3));
    drawHead();
    rows.forEach((row, i) => drawRow(row, i, false));
    if (total) drawRow(total, 0, true);
    doc.x = M.left;
    doc.moveDown(0.6);
  }

  /* Histogramme */
  function barChart(data, { format = num, height = 130, labelEvery = 1 } = {}) {
    space(height + 30);
    const top = niceTop(Math.max(...data.map((d) => d.value)), format === duration);
    const x0 = M.left + 46;
    const innerW = W - 46;
    const y0 = doc.y + 6;
    const band = innerW / data.length;
    const barW = Math.max(1, Math.min(22, band * 0.72));
    doc.font('Helvetica').fontSize(6.8).fillColor(LIGHT);
    for (let k = 0; k <= 4; k++) {
      const y = y0 + height - (k / 4) * height;
      doc.moveTo(x0, y).lineTo(x0 + innerW, y).lineWidth(0.4).strokeColor(LINE).stroke();
      text(format((top * k) / 4), M.left, y - 3, { width: 40, align: 'right', lineBreak: false });
    }
    data.forEach((d, i) => {
      const h = (d.value / top) * height;
      const x = x0 + i * band + (band - barW) / 2;
      if (h > 0) doc.rect(x, y0 + height - h, barW, h).fill(brand);
      if (i % labelEvery === 0) {
        doc.font('Helvetica').fontSize(6.5).fillColor(LIGHT);
        text(d.label, x0 + i * band - 14 + band / 2, y0 + height + 4, { width: 28, align: 'center', lineBreak: false });
      }
    });
    doc.y = y0 + height + 18;
    doc.x = M.left;
    doc.moveDown(0.4);
  }

  /* Tuiles de chiffres clés */
  function tiles(items) {
    const gap = 10;
    const w = (W - gap * (items.length - 1)) / items.length;
    space(66);
    const y = doc.y;
    items.forEach(([label, value, delta], i) => {
      const x = M.left + i * (w + gap);
      doc.roundedRect(x, y, w, 58, 6).fill('#F1F5FB');
      doc.rect(x, y, 3, 58).fill(brand);
      doc.font('Helvetica').fontSize(7.8).fillColor(GRAY);
      text(label, x + 10, y + 8, { width: w - 16, lineBreak: false, ellipsis: true });
      doc.font('Helvetica-Bold').fontSize(15).fillColor('#111827');
      text(value, x + 10, y + 21, { width: w - 16, lineBreak: false });
      doc.font('Helvetica').fontSize(7).fillColor(delta.startsWith('-') ? '#B91C1C' : '#047857');
      text(`${delta} vs période préc.`, x + 10, y + 42, { width: w - 16, lineBreak: false, ellipsis: true });
    });
    doc.y = y + 70;
    doc.x = M.left;
  }

  /* ---------- Données dérivées ---------- */
  const tt = r.totals;
  const pv = r.previous;
  const byMonth = r.daily.length > 62;
  const periods = byMonth
    ? Object.values(
        r.daily.reduce((acc, d) => {
          const k = d.day.slice(0, 7);
          acc[k] ||= { key: k, label: monthLabel(k), short: new Date(`${k}-15T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' }), visitors: 0, pageviews: 0, plays: 0, watchSeconds: 0 };
          for (const f of ['visitors', 'pageviews', 'plays', 'watchSeconds']) acc[k][f] += d[f];
          return acc;
        }, {}),
      )
    : r.daily.map((d) => ({ ...d, key: d.day, label: dayLabel(d.day), short: d.day.slice(8, 10) }));
  const labelEvery = Math.ceil(periods.length / 16);
  const showTitle = (slug) => shows.find((s) => s.slug === slug)?.title || '';
  const trText = (v) => (typeof v === 'string' ? v : v?.fr || v?.en || '');
  const contentName = (target) => {
    if (target === 'live') return ['Direct (page Regarder)', 'Direct'];
    if (target.startsWith('yt:')) return [videoTitle(target.slice(3)) || `Vidéo YouTube ${target.slice(3)}`, 'YouTube (sur nos réseaux)'];
    const ep = episodes.find((e) => e.id === target);
    return ep ? [trText(ep.title), trText(showTitle(ep.show))] : [target, 'Épisode supprimé'];
  };
  const pageName = (p) => {
    if (PAGE_NAMES[p]) return PAGE_NAMES[p];
    const m = /^\/emissions\/(.+)$/.exec(p);
    if (m) return `Émission : ${trText(showTitle(m[1])) || m[1]}`;
    const a = /^\/actualites\/(.+)$/.exec(p);
    if (a) return `Article : ${a[1]}`;
    return p;
  };
  const sumOf = (rows) => rows.reduce((s, x) => s + x.visitors, 0);

  /* ---------- Page de titre ---------- */
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#111827');
  text(title.toUpperCase(), M.left, doc.y, { width: W });
  doc.moveDown(0.25);
  doc.font('Helvetica').fontSize(10.5).fillColor(GRAY);
  text(`Période : du ${dateLong(r.from)} au ${dateLong(r.to)} (${num(r.days)} jour${r.days > 1 ? 's' : ''})`, M.left, doc.y, { width: W });
  doc.fontSize(8.5).fillColor(LIGHT);
  text(`Comparée à la période précédente de même durée : du ${dateLong(r.previousFrom)} au ${dateLong(r.previousTo)}.`, M.left, doc.y + 2, { width: W });
  text(`Établi le ${dateLong(today)} à ${nowTime} (heure de Kinshasa)${author ? ` par ${author}` : ''}.`, M.left, doc.y + 1, { width: W });
  doc.moveDown(0.6);

  const showVisits = kind !== 'views';
  const showViews = kind !== 'visits';

  /* ---------- 1. Synthèse ---------- */
  section('Synthèse de la période', 'Chiffres clés de la période et évolution par rapport à la période précédente de même durée.');
  const keyTiles = [];
  if (showVisits) keyTiles.push(['Visiteurs', num(tt.visitors), evolution(tt.visitors, pv.visitors)], ['Pages vues', num(tt.pageviews), evolution(tt.pageviews, pv.pageviews)]);
  if (showViews) keyTiles.push(['Lancements de lecture', num(tt.plays), evolution(tt.plays, pv.plays)], ['Temps total regardé', duration(tt.watchSeconds), evolution(tt.watchSeconds, pv.watchSeconds)]);
  if (keyTiles.length === 2 && showVisits) keyTiles.push(['Pages par visiteur', tt.visitors ? (tt.pageviews / tt.visitors).toFixed(1).replace('.', ',') : '—', evolution(tt.visitors ? tt.pageviews / tt.visitors : 0, pv.visitors ? pv.pageviews / pv.visitors : 0)]);
  if (keyTiles.length === 2 && showViews) keyTiles.push(['Temps regardé (direct)', duration(tt.liveSeconds), evolution(tt.liveSeconds, pv.liveSeconds)]);
  tiles(keyTiles);

  const indicators = [];
  if (showVisits) {
    indicators.push(
      ['Visiteurs (personnes différentes par jour)', num(tt.visitors), num(pv.visitors), evolution(tt.visitors, pv.visitors)],
      ['Pages vues', num(tt.pageviews), num(pv.pageviews), evolution(tt.pageviews, pv.pageviews)],
      ['Pages vues par visiteur', tt.visitors ? (tt.pageviews / tt.visitors).toFixed(1).replace('.', ',') : '—', pv.visitors ? (pv.pageviews / pv.visitors).toFixed(1).replace('.', ',') : '—', ''],
      ['Moyenne de visiteurs par jour', num(tt.visitors / r.days), num(pv.visitors / r.days), evolution(tt.visitors, pv.visitors)],
    );
  }
  if (showViews) {
    indicators.push(
      ['Lancements de lecture (tous contenus)', num(tt.plays), num(pv.plays), evolution(tt.plays, pv.plays)],
      ['   dont direct', num(tt.livePlays), num(pv.livePlays), evolution(tt.livePlays, pv.livePlays)],
      ['Temps total regardé', duration(tt.watchSeconds), duration(pv.watchSeconds), evolution(tt.watchSeconds, pv.watchSeconds)],
      ['   dont direct', duration(tt.liveSeconds), duration(pv.liveSeconds), evolution(tt.liveSeconds, pv.liveSeconds)],
      ['Durée moyenne par lancement', tt.plays ? duration(tt.watchSeconds / tt.plays) : '—', pv.plays ? duration(pv.watchSeconds / pv.plays) : '—', ''],
    );
  }
  table(
    [{ label: 'Indicateur', width: 0.46 }, { label: 'Période', width: 0.18, align: 'right' }, { label: 'Période précédente', width: 0.2, align: 'right' }, { label: 'Évolution', width: 0.16, align: 'right' }],
    indicators,
  );
  if (tt.pageviews === 0 && tt.plays === 0) note('Aucune visite ni lecture n’a été enregistrée sur cette période.');

  /* ---------- Visites ---------- */
  if (showVisits) {
    section('Visites du site', `Fréquentation ${byMonth ? 'mois par mois' : 'jour par jour'}. Un visiteur est une personne différente sur une journée (mesure anonyme, sans cookie).`);
    subTitle(`Visiteurs par ${byMonth ? 'mois' : 'jour'}`, 190);
    barChart(periods.map((d) => ({ value: d.visitors, label: d.short })), { labelEvery });
    subTitle(`Détail par ${byMonth ? 'mois' : 'jour'}`);
    table(
      [{ label: byMonth ? 'Mois' : 'Jour', width: 0.3 }, { label: 'Visiteurs', width: 0.15, align: 'right' }, { label: 'Pages vues', width: 0.15, align: 'right' }, { label: 'Lancements', width: 0.17, align: 'right' }, { label: 'Temps regardé', width: 0.23, align: 'right' }],
      periods.map((d) => [d.label, num(d.visitors), num(d.pageviews), num(d.plays), duration(d.watchSeconds)]),
      { total: ['Total', num(tt.visitors), num(tt.pageviews), num(tt.plays), duration(tt.watchSeconds)] },
    );
    subTitle('Pages les plus consultées');
    table(
      [{ label: 'Page', width: 0.52 }, { label: 'Vues', width: 0.16, align: 'right' }, { label: 'Part des vues', width: 0.16, align: 'right' }, { label: 'Visiteurs', width: 0.16, align: 'right' }],
      r.pages.map((p) => [pageName(p.path), num(p.views), pct(p.views, tt.pageviews), num(p.visitors)]),
    );
    subTitle('Provenance des visiteurs');
    const srcTotal = sumOf(r.sources);
    table(
      [{ label: 'Origine', width: 0.6 }, { label: 'Visiteurs', width: 0.2, align: 'right' }, { label: 'Part', width: 0.2, align: 'right' }],
      r.sources.map((s) => [SOURCE_NAMES[s.key] || s.key, num(s.visitors), pct(s.visitors, srcTotal)]),
    );
  }

  /* ---------- Visionnage ---------- */
  if (showViews) {
    section('Visionnage', 'Lectures du direct, des épisodes et des vidéos YouTube intégrées au site. Le temps regardé est mesuré pendant la lecture effective.');
    subTitle(`Temps regardé par ${byMonth ? 'mois' : 'jour'}`, 190);
    barChart(periods.map((d) => ({ value: d.watchSeconds, label: d.short })), { format: duration, labelEvery });
    if (!showVisits) {
      subTitle(`Détail par ${byMonth ? 'mois' : 'jour'}`);
      table(
        [{ label: byMonth ? 'Mois' : 'Jour', width: 0.4 }, { label: 'Lancements', width: 0.3, align: 'right' }, { label: 'Temps regardé', width: 0.3, align: 'right' }],
        periods.map((d) => [d.label, num(d.plays), duration(d.watchSeconds)]),
        { total: ['Total', num(tt.plays), duration(tt.watchSeconds)] },
      );
    }
    subTitle('Contenus les plus regardés');
    table(
      [
        { label: 'Contenu', width: 0.31 }, { label: 'Émission / origine', width: 0.18 }, { label: 'Lancements', width: 0.13, align: 'right' },
        { label: 'Spectateurs', width: 0.13, align: 'right' }, { label: 'Temps regardé', width: 0.15, align: 'right' }, { label: 'Part', width: 0.1, align: 'right' },
      ],
      r.content.map((c) => {
        const [name, sub] = contentName(c.target);
        return [name, sub, num(c.plays), num(c.viewers), duration(c.watchSeconds), pct(c.watchSeconds, tt.watchSeconds)];
      }),
      { empty: 'Aucune lecture enregistrée sur cette période.' },
    );
    subTitle('Écoute du direct selon l’heure (heure de Kinshasa)', 190);
    note('Temps regardé sur le direct, cumulé sur la période, pour chaque heure de la journée.');
    barChart(r.hourly.map((h) => ({ value: h.watchSeconds, label: `${h.hour}h` })), { format: duration, labelEvery: 2, height: 110 });
    const peak = [...r.hourly].sort((a, b) => b.watchSeconds - a.watchSeconds)[0];
    if (peak?.watchSeconds) note(`Heure de plus forte audience du direct : ${peak.hour} h – ${peak.hour + 1} h (${duration(peak.watchSeconds)} regardées).`);
  }

  /* ---------- Profil du public ---------- */
  section('Profil du public', 'Répartition des visiteurs selon l’appareil utilisé et la langue choisie sur le site.');
  const devTotal = sumOf(r.devices);
  subTitle('Appareils');
  table(
    [{ label: 'Appareil', width: 0.6 }, { label: 'Visiteurs', width: 0.2, align: 'right' }, { label: 'Part', width: 0.2, align: 'right' }],
    r.devices.map((d) => [DEVICE_NAMES[d.key] || d.key, num(d.visitors), pct(d.visitors, devTotal)]),
  );
  const langTotal = sumOf(r.langs);
  subTitle('Langue du site');
  table(
    [{ label: 'Langue', width: 0.6 }, { label: 'Visiteurs', width: 0.2, align: 'right' }, { label: 'Part', width: 0.2, align: 'right' }],
    r.langs.map((d) => [LANG_NAMES[d.key] || d.key, num(d.visitors), pct(d.visitors, langTotal)]),
  );

  /* ---------- Méthodologie ---------- */
  subTitle('Méthode de mesure');
  note(
    'Mesure d’audience intégrée au site, anonyme et sans cookie : aucun visiteur n’est suivi d’un jour à l’autre. Les robots et l’administration ne sont pas comptés. ' +
      'Les lectures en dehors du site (application YouTube, Facebook, télévision) ne figurent pas dans ce rapport. Les données sont conservées 400 jours.',
  );

  /* ---------- Signature ---------- */
  space(150);
  doc.moveDown(1.2);
  const sx = M.left + W - 230;
  let sy = doc.y;
  doc.font('Helvetica').fontSize(9.5).fillColor('#111827');
  text(`Fait à ${signer.city}, le ${dateLong(today)}`, sx, sy, { width: 230, align: 'center' });
  sy = doc.y + 4;
  doc.font('Helvetica-Bold').fontSize(9.5);
  text(`Le ${signer.title}`, sx, sy, { width: 230, align: 'center' });
  sy = doc.y + 4;
  if (signature) {
    try {
      doc.image(signature, sx + 45, sy, { fit: [140, 60], align: 'center', valign: 'center' });
    } catch {
      /* image illisible : on garde l'espace pour signer à la main */
    }
  }
  sy += 66;
  doc.moveTo(sx + 30, sy).lineTo(sx + 200, sy).lineWidth(0.5).strokeColor('#9CA3AF').stroke();
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827');
  text(signer.name || '', sx, sy + 5, { width: 230, align: 'center' });
  doc.font('Helvetica').fontSize(8.5).fillColor(GRAY);
  text(`${signer.title}, ${siteName}`, sx, doc.y + 1, { width: 230, align: 'center' });

  /* ---------- Pied de page : numérotation ---------- */
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = A4.h - 40;
    doc.moveTo(M.left, y - 6).lineTo(M.left + W, y - 6).lineWidth(0.4).strokeColor(LINE).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(LIGHT);
    // Écrire sous la marge basse sans créer de nouvelle page
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    text(`${title} · ${siteName} · du ${dateShort(r.from)} au ${dateShort(r.to)}`, M.left, y, { width: W * 0.75, lineBreak: false, ellipsis: true });
    text(`Page ${i - range.start + 1} / ${range.count}`, M.left, y, { width: W, align: 'right', lineBreak: false });
    doc.page.margins.bottom = bottom;
  }

  doc.end();
  return done;
}
