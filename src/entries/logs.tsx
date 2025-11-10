import React from 'react';
import ReactDOM from 'react-dom/client';
import LogStreamModal from '../powerup/components/LogStreamModal';

ReactDOM.createRoot(document.getElementById('logs-root') as HTMLElement).render(
  <React.StrictMode>
    <LogStreamModal />
  </React.StrictMode>,
);
