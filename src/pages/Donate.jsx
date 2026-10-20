import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { Check, Heart } from '../components/Icons';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';
import content from '../data/content.json';

const PRESETS = { USD: [10, 25, 50, 100], CDF: [25000, 50000, 100000, 250000] };
const OPERATORS = ['M-Pesa (Vodacom)', 'Orange Money', 'Airtel Money', 'Afrimoney'];

function Choice({ name, value, checked, onChange, children }) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-center rounded-xl border-2 px-4 py-3 text-center font-heading font-semibold transition focus-within:ring-2 focus-within:ring-accent ${checked ? 'border-brand bg-brand text-white' : 'border-gray-200 bg-white text-ink hover:border-brand'}`}
    >
      <input type="radio" className="sr-only" name={name} value={value} checked={checked} onChange={() => onChange(value)} />
      {children}
    </label>
  );
}

function Field({ id, label, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {error && <p id={`${id}-error`} className="error-text">{error}</p>}
    </div>
  );
}

const fmt = (n, cur, lang) => {
  const num = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { maximumFractionDigits: 0 }).format(n);
  if (cur === 'CDF') return `${num} FC`;
  return lang === 'en' ? `$${num}` : `${num} $`;
};

export default function Donate({ regular = false }) {
  const { t, lang } = useLang();
  useSeo({ title: regular ? t('donate.regularTitle') : t('donate.title'), description: t('donate.intro') });

  const [f, setF] = useState({
    frequency: regular ? 'monthly' : 'once',
    currency: 'USD',
    amount: 25,
    other: '',
    method: 'mobile',
    operator: OPERATORS[0],
    phone: '',
    cardName: '',
    cardNumber: '',
    expiry: '',
    cvc: '',
    name: '',
    email: '',
  });
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));

  const amount = f.amount === 'other' ? Number(f.other) : f.amount;

  const validate = () => {
    const e = {};
    if (!amount || amount <= 0) e.amount = t('donate.invalidAmount');
    if (!f.name.trim()) e.name = t('common.required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = t('common.invalidEmail');
    if (f.method === 'mobile' && !/^(\+?243|0)?\d{9}$/.test(f.phone.replace(/[\s.-]/g, ''))) e.phone = t('donate.invalidPhone');
    if (f.method === 'card') {
      if (!f.cardName.trim()) e.cardName = t('common.required');
      if (!/^\d{13,19}$/.test(f.cardNumber.replace(/\s/g, ''))) e.cardNumber = t('donate.invalidCard');
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(f.expiry)) e.expiry = t('common.required');
      if (!/^\d{3,4}$/.test(f.cvc)) e.cvc = t('common.required');
    }
    return e;
  };

  const submit = (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(Object.keys(e)[0] === 'amount' ? 'amount-other' : Object.keys(e)[0])?.focus();
      return;
    }
    // TODO : appeler l'API du prestataire de paiement (Mobile Money / carte) côté serveur.
    setDone(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const err = (k) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${k}-error` : undefined });

  return (
    <>
      <PageHeader title={regular ? t('donate.regularTitle') : t('donate.title')} intro={regular ? t('donate.regularText') : t('donate.intro')} />

      <section className="container-page grid gap-10 py-12 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {done ? (
            <div role="status" className="rounded-3xl bg-green-50 p-10 text-center ring-1 ring-green-200">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-white"><Check className="h-8 w-8" /></span>
              <h2 className="mt-5 text-2xl font-bold">{t('donate.thanks')}</h2>
              <p className="mt-2 text-gray-700">
                {fmt(amount, f.currency, lang)} {f.frequency === 'monthly' && t('donate.perMonth')} — {t('donate.thanksText')}
              </p>
              <Link to="/" className="btn-primary mt-6">{t('common.home')}</Link>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
              <fieldset>
                <legend className="label text-base">{t('donate.frequency')}</legend>
                <div className="grid grid-cols-2 gap-3">
                  <Choice name="frequency" value="once" checked={f.frequency === 'once'} onChange={set('frequency')}>{t('donate.once')}</Choice>
                  <Choice name="frequency" value="monthly" checked={f.frequency === 'monthly'} onChange={set('frequency')}>{t('donate.monthly')}</Choice>
                </div>
              </fieldset>

              <fieldset>
                <div className="mb-1.5 flex items-center justify-between">
                  <legend className="label mb-0 text-base">{t('donate.amount')}</legend>
                  <label className="flex items-center gap-2 text-sm">
                    <span>{t('donate.currency')}</span>
                    <select
                      value={f.currency}
                      onChange={(e) => setF((s) => ({ ...s, currency: e.target.value, amount: PRESETS[e.target.value][1], other: '' }))}
                      className="rounded-lg border border-gray-300 px-2 py-1"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="CDF">CDF (FC)</option>
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {PRESETS[f.currency].map((v) => (
                    <Choice key={v} name="amount" value={v} checked={f.amount === v} onChange={set('amount')}>{fmt(v, f.currency, lang)}</Choice>
                  ))}
                </div>
                <div className="mt-3">
                  <label htmlFor="amount-other" className="sr-only">{t('donate.other')}</label>
                  <input
                    id="amount-other"
                    type="number"
                    min="1"
                    inputMode="numeric"
                    placeholder={`${t('donate.other')} (${f.currency})`}
                    value={f.other}
                    onFocus={() => set('amount')('other')}
                    onChange={(e) => setF((s) => ({ ...s, amount: 'other', other: e.target.value }))}
                    className={`input ${f.amount === 'other' ? 'border-brand ring-2 ring-brand/30' : ''}`}
                    {...err('amount')}
                    aria-describedby={errors.amount ? 'amount-error' : undefined}
                  />
                  {errors.amount && <p id="amount-error" className="error-text">{errors.amount}</p>}
                </div>
              </fieldset>

              <fieldset>
                <legend className="label text-base">{t('donate.method')}</legend>
                <div className="grid grid-cols-2 gap-3">
                  <Choice name="method" value="mobile" checked={f.method === 'mobile'} onChange={set('method')}>📱 {t('donate.mobileMoney')}</Choice>
                  <Choice name="method" value="card" checked={f.method === 'card'} onChange={set('method')}>💳 {t('donate.card')}</Choice>
                </div>

                {f.method === 'mobile' ? (
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field id="operator" label={t('donate.operator')}>
                      <select id="operator" value={f.operator} onChange={set('operator')} className="input">
                        {OPERATORS.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field id="phone" label={t('donate.phone')} error={errors.phone}>
                      <input id="phone" type="tel" autoComplete="tel" placeholder="+243 8x xxx xxxx" value={f.phone} onChange={set('phone')} className="input" {...err('phone')} />
                    </Field>
                  </div>
                ) : (
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Field id="cardName" label={t('donate.cardName')} error={errors.cardName}>
                        <input id="cardName" autoComplete="cc-name" value={f.cardName} onChange={set('cardName')} className="input" {...err('cardName')} />
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <Field id="cardNumber" label={t('donate.cardNumber')} error={errors.cardNumber}>
                        <input id="cardNumber" inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" value={f.cardNumber} onChange={set('cardNumber')} className="input" {...err('cardNumber')} />
                      </Field>
                    </div>
                    <Field id="expiry" label={t('donate.expiry')} error={errors.expiry}>
                      <input id="expiry" autoComplete="cc-exp" placeholder="MM/AA" value={f.expiry} onChange={set('expiry')} className="input" {...err('expiry')} />
                    </Field>
                    <Field id="cvc" label={t('donate.cvc')} error={errors.cvc}>
                      <input id="cvc" inputMode="numeric" autoComplete="cc-csc" value={f.cvc} onChange={set('cvc')} className="input" {...err('cvc')} />
                    </Field>
                  </div>
                )}
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="name" label={t('donate.fullName')} error={errors.name}>
                  <input id="name" autoComplete="name" value={f.name} onChange={set('name')} className="input" {...err('name')} />
                </Field>
                <Field id="email" label={t('donate.email')} error={errors.email}>
                  <input id="email" type="email" autoComplete="email" value={f.email} onChange={set('email')} className="input" {...err('email')} />
                </Field>
              </div>

              <button type="submit" className="btn-accent w-full py-4 text-lg">
                <Heart className="h-5 w-5" />
                {t('donate.submit')} {amount > 0 && fmt(amount, f.currency, lang)} {f.frequency === 'monthly' && amount > 0 && t('donate.perMonth')}
              </button>
              <p className="rounded-xl bg-mist p-3 text-xs text-gray-700">{t('donate.demo')}</p>
            </form>
          )}
        </div>

        <aside className="space-y-6 lg:col-span-2">
          <div className="rounded-3xl bg-brand p-8 text-white">
            <h2 className="text-xl font-bold text-white">{t('donate.regularTitle')}</h2>
            <p className="mt-3 text-white/85">{t('donate.regularText')}</p>
            <ul className="mt-6 space-y-4">
              {t('donate.impact').map((i) => (
                <li key={i.amount} className="flex items-center gap-4">
                  <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-xl bg-accent font-heading font-bold text-ink">{i.amount}</span>
                  <span className="text-sm text-white/90">{i.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <figure className="rounded-3xl bg-mist p-8">
            <blockquote className="text-lg italic text-gray-800">{content.testimonials[1].text[lang]}</blockquote>
            <figcaption className="mt-3 font-semibold text-brand">— {content.testimonials[1].name}</figcaption>
            <Link to="/dons/temoignages" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">{t('nav.testimonials')} →</Link>
          </figure>
        </aside>
      </section>
    </>
  );
}
