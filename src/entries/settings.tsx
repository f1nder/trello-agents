import React from 'react';
import ReactDOM from 'react-dom/client';
import BoardSettingsPage from '../settings/BoardSettingsPage';

ReactDOM.createRoot(document.getElementById('settings-root') as HTMLElement).render(
  <React.StrictMode>
    <BoardSettingsPage />
  </React.StrictMode>,
);
