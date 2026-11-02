import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { NETWORKS, SocialCard, useSocialFeed } from '../components/SocialFeed';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';

const PAGE = 12;

export default function SocialPage() {
  const { t } = useLang();
  const [network, setNetwork] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const feed = useSocialFeed(limit, network);
  const all = useSocialFeed(1); // liste des réseaux qui ont des contenus publiés
  useSeo({ title: t('social.title'), description: t('social.intro') });
  const chip = (active) => `min-h-[40px] rounded-full px-4 text-sm font-semibold transition ${active ? 'bg-brand text-white' : 'bg-white text-gray-700 ring-1 ring-black/10 hover:text-brand'}`;
  const choose = (n) => {
    setNetwork(n);
    setLimit(PAGE);
  };

  return (
    <>
      <PageHeader title={t('social.title')} intro={t('social.intro')} />
      <div className="container-page py-12">
        {all?.networks.length > 1 && (
          <div role="group" aria-label={t('social.networks')} className="mb-8 flex flex-wrap gap-2">
            <button type="button" onClick={() => choose('')} aria-pressed={!network} className={chip(!network)}>{t('common.allCategories')}</button>
            {all.networks.map((n) => (
              <button key={n} type="button" onClick={() => choose(n)} aria-pressed={network === n} className={chip(network === n)}>{NETWORKS[n].label}</button>
            ))}
          </div>
        )}
        {feed === null && <p className="py-10 text-center text-gray-500">…</p>}
        {feed?.items.length === 0 && <EmptyState />}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {feed?.items.map((i) => <SocialCard key={i.key} item={i} />)}
        </div>
        {feed?.items.length === limit && limit < 60 && (
          <div className="mt-10 text-center">
            <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="btn-outline px-7 py-3">{t('social.more')}</button>
          </div>
        )}
      </div>
    </>
  );
}
