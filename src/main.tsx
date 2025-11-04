import React from 'react';
import ReactDOM from 'react-dom/client';
import ExcelChangeTracker from './ExcelChangeTracker';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ExcelChangeTracker />
  </React.StrictMode>,
);
