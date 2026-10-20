import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import { useLang } from './i18n/LanguageContext';
import { trackPageview } from './analytics';

// Découpage du code par page : seule l'accueil est chargée immédiatement.
const Watch = lazy(() => import('./pages/Watch'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Shows = lazy(() => import('./pages/Shows'));
const ShowDetail = lazy(() => import('./pages/ShowDetail'));
const Episodes = lazy(() => import('./pages/Episodes'));
const Donate = lazy(() => import('./pages/Donate'));
const Testimonials = lazy(() => import('./pages/Testimonials'));
const Events = lazy(() => import('./pages/Events'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const News = lazy(() => import('./pages/News'));
const Network = lazy(() => import('./pages/Network'));
const HowToWatchPage = lazy(() => import('./pages/Misc').then((m) => ({ default: m.HowToWatchPage })));
const LegalPage = lazy(() => import('./pages/Misc').then((m) => ({ default: m.LegalPage })));
const NotFound = lazy(() => import('./pages/NotFound'));
const Admin = lazy(() => import('./admin/Admin'));

/** Remonte en haut à chaque navigation, ou défile vers l'ancre (#equipe…). */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const tryScroll = (n = 0) => {
        const el = document.getElementById(hash.slice(1));
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else if (n < 20) setTimeout(() => tryScroll(n + 1), 50); // page chargée en lazy
      };
      tryScroll();
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);
  return null;
}

function Loader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Chargement">
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-brand/20 border-t-brand" />
    </div>
  );
}

export default function App() {
  const { t } = useLang();
  const { pathname } = useLocation();

  // Une page vue par changement d'adresse (le délai laisse la page mettre à jour sa langue).
  useEffect(() => {
    const id = setTimeout(trackPageview, 300);
    return () => clearTimeout(id);
  }, [pathname]);

  if (pathname.startsWith('/admin')) {
    return (
      <Suspense fallback={<Loader />}>
        <Admin />
      </Suspense>
    );
  }

  return (
    <>
      <a href="#main" className="sr-only z-[60] rounded-full bg-accent px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        {t('common.skip')}
      </a>
      <ScrollManager />
      <Header />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/regarder" element={<Watch />} />
            <Route path="/programme" element={<Schedule />} />
            <Route path="/comment-nous-regarder" element={<HowToWatchPage />} />
            <Route path="/emissions" element={<Shows />} />
            <Route path="/emissions/:slug" element={<ShowDetail />} />
            <Route path="/episodes" element={<Episodes />} />
            <Route path="/dons" element={<Donate />} />
            <Route path="/dons/reguliers" element={<Donate regular />} />
            <Route path="/dons/temoignages" element={<Testimonials />} />
            <Route path="/evenements" element={<Events />} />
            <Route path="/apropos" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/actualites" element={<News />} />
            <Route path="/reseau" element={<Network />} />
            <Route path="/faq" element={<LegalPage kind="faq" />} />
            <Route path="/confidentialite" element={<LegalPage kind="privacy" />} />
            <Route path="/conditions" element={<LegalPage kind="terms" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
