import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-mono';
import './index.css';
import './styles/tokens.css';
import { initTheme } from './theme/theme';
import App from './App.tsx';

initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
