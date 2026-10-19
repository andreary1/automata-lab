import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { projectStore, useApp } from './state/store';
import { App } from './ui/App';
import './ui/styles.css';

// Garante que o projeto inicial exista no armazenamento local.
projectStore.save(useApp.getState().project);
document.documentElement.dataset.theme = useApp.getState().theme;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
