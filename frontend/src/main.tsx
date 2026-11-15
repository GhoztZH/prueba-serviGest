import '@fontsource-variable/inter';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './shared/styles/tokens.css';
import './shared/styles/app.css';

const elementoRaiz = document.getElementById('root');
if (!elementoRaiz) {
  throw new Error('No se encontró el elemento #root en el documento');
}

createRoot(elementoRaiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
