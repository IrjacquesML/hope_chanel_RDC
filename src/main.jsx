import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import { hydrateData } from './lib';
import App from './App';
import './index.css';

hydrateData().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      {/* Comportements de React Router v7 activés dès maintenant (supprime les avertissements de la console) */}
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
});
