import React from 'react';
import ReactDOM from 'react-dom/client';
import CardBackShell from '../powerup/components/CardBackShell';

ReactDOM.createRoot(document.getElementById('card-back-root') as HTMLElement).render(
  <React.StrictMode>
    <CardBackShell />
  </React.StrictMode>,
);
