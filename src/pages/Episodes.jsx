import PageHeader from '../components/PageHeader';
import EpisodeCard from '../components/EpisodeCard';
import { getSortedEpisodes } from '../lib';
import { useLang } from '../i18n/LanguageContext';
import { useSeo } from '../hooks/useSeo';

export default function Episodes() {
  const { t } = useLang();
  useSeo({ title: t('shows.allEpisodes'), description: t('shows.allEpisodesIntro') });
  return (
    <>
      <PageHeader title={t('shows.allEpisodes')} intro={t('shows.allEpisodesIntro')} />
      <section className="container-page grid gap-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
        {getSortedEpisodes().map((e) => <EpisodeCard key={e.id} episode={e} />)}
      </section>
    </>
  );
}
