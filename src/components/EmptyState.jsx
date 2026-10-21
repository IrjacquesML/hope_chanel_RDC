import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';

/** Message affiché quand une liste gérée dans l'admin est vide (actualités, épisodes, témoignages…). */
export default function EmptyState({ message, className = '' }) {
  const { t } = useLang();
  return (
    <div className={`rounded-3xl bg-mist px-6 py-12 text-center ${className}`}>
      <p className="mx-auto max-w-md text-gray-700">{message || t('common.empty')}</p>
      <Link to="/regarder" className="btn-primary mt-6">{t('common.watchLive')}</Link>
    </div>
  );
}
