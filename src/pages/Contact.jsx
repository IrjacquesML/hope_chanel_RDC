import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import { Check, Mail, MapPin, Phone, WhatsApp } from '../components/Icons';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';
import content from '../data/content.json';

export default function Contact() {
  const { t } = useLang();
  useSeo({ title: t('nav.contact'), description: t('contact.intro') });
  const { contact } = content;
  const [f, setF] = useState({ name: '', email: '', subject: 0, message: '' });
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = (ev) => {
    ev.preventDefault();
    const e = {};
    if (!f.name.trim()) e.name = t('common.required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = t('common.invalidEmail');
    if (!f.message.trim()) e.message = t('common.required');
    setErrors(e);
    if (Object.keys(e).length) return document.getElementById(`c-${Object.keys(e)[0]}`)?.focus();
    setDone(true); // TODO : envoyer vers l'API / service d'e-mail
  };

  const a11y = (k) => ({ id: `c-${k}`, 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `c-${k}-err` : undefined });
  const Err = ({ k }) => errors[k] ? <p id={`c-${k}-err`} className="error-text">{errors[k]}</p> : null;
  const { lat, lon } = contact.map;
  const bbox = [lon - 0.02, lat - 0.012, lon + 0.02, lat + 0.012].join('%2C');

  return (
    <>
      <PageHeader title={t('contact.title')} intro={t('contact.intro')} />
      <section className="container-page grid gap-10 py-12 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {done ? (
            <p role="status" className="flex items-center gap-3 rounded-2xl bg-green-50 p-6 font-medium text-green-800 ring-1 ring-green-200">
              <Check /> {t('contact.ok')}
            </p>
          ) : (
            <form onSubmit={submit} noValidate className="grid gap-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:grid-cols-2 sm:p-8">
              <div>
                <label htmlFor="c-name" className="label">{t('contact.name')}</label>
                <input autoComplete="name" value={f.name} onChange={set('name')} className="input" {...a11y('name')} />
                <Err k="name" />
              </div>
              <div>
                <label htmlFor="c-email" className="label">{t('contact.email')}</label>
                <input type="email" autoComplete="email" value={f.email} onChange={set('email')} className="input" {...a11y('email')} />
                <Err k="email" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="c-subject" className="label">{t('contact.subject')}</label>
                <select value={f.subject} onChange={set('subject')} className="input" id="c-subject">
                  {t('contact.subjects').map((s, i) => <option key={s} value={i}>{s}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="c-message" className="label">{t('contact.message')}</label>
                <textarea rows={6} value={f.message} onChange={set('message')} className="input" {...a11y('message')} />
                <Err k="message" />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" className="btn-primary px-8 py-3">{t('common.send')}</button>
              </div>
            </form>
          )}
        </div>

        <aside className="space-y-6 lg:col-span-2">
          <ul className="space-y-4 rounded-3xl bg-mist p-6">
            <li className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand" /><span><strong className="block">{t('contact.address')}</strong>{contact.address}</span></li>
            <li className="flex gap-3"><Phone className="mt-0.5 h-5 w-5 shrink-0 text-brand" /><span><strong className="block">{t('contact.phone')}</strong>{contact.phones.map((p) => <a key={p} href={`tel:${p.replace(/\s/g, '')}`} className="block hover:text-brand">{p}</a>)}</span></li>
            <li className="flex gap-3"><WhatsApp className="mt-0.5 h-5 w-5 shrink-0 text-brand" /><span><strong className="block">WhatsApp</strong><a href={content.social.whatsapp} className="hover:text-brand">{contact.whatsapp}</a></span></li>
            <li className="flex gap-3"><Mail className="mt-0.5 h-5 w-5 shrink-0 text-brand" /><span><strong className="block">E-mail</strong><a href={`mailto:${contact.email}`} className="hover:text-brand">{contact.email}</a></span></li>
          </ul>
          <div className="overflow-hidden rounded-3xl shadow-sm ring-1 ring-black/5">
            <iframe
              title={t('contact.mapTitle')}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`}
              loading="lazy"
              className="h-72 w-full border-0"
            />
          </div>
        </aside>
      </section>
    </>
  );
}
