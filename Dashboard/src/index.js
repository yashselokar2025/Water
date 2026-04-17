import React from 'react';
import ReactDOM from 'react-dom';

// Suppress ResizeObserver loop error which can be triggered by Recharts/Syncfusion
window.addEventListener('error', (e) => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.' || e.message === 'ResizeObserver loop limit exceeded') {
    e.stopImmediatePropagation();
    const resizeObserverErrGuid = '8ca36332-94da-4475-b384-cb904d46781b';
    const resizeObserverErr = document.getElementById(resizeObserverErrGuid);
    if (resizeObserverErr) {
      resizeObserverErr.style.display = 'none';
    }
  }
});

import './index.css';
import App from './App';
import { ContextProvider } from './contexts/ContextProvider';

ReactDOM.render(
  <React.StrictMode>
    <ContextProvider>
      <App />
    </ContextProvider>
  </React.StrictMode>,
  document.getElementById('root'),
);
