import React from 'react';
import ReactDOM from 'react-dom/client';
import LogStreamPlaceholder from '../powerup/components/LogStreamPlaceholder';

ReactDOM.createRoot(document.getElementById('logs-root') as HTMLElement).render(
  <React.StrictMode>
    <LogStreamPlaceholder />
  </React.StrictMode>,
);
