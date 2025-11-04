import React, { useEffect, useState } from 'react';
import CheckTpass from './CheckTpass';
import ExcelChangeTracker from './ExcelChangeTracker';
import AppFooter from './AppFooter';


// Các route đơn giản qua URL hash
// #/tpass hoặc #/excel-diff

type View = 'tpass' | 'excel-diff';

const getViewFromHash = (): View => {
  const hash = (window.location.hash || '').toLowerCase();
  if (hash.includes('excel')) return 'excel-diff';
  return 'tpass';
};

export default function App() {
  const [view, setView] = useState<View>(getViewFromHash());

  useEffect(() => {
    const onHashChange = () => setView(getViewFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const goto = (v: View) => {
    window.location.hash = v === 'tpass' ? '/tpass' : '/excel-diff';
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-gray-900">Excel Tools</span>
            <span className="text-gray-400">|</span>
            <nav className="flex items-center gap-2">
              <button
                onClick={() => goto('tpass')}
                className={`${view === 'tpass' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} px-3 py-1.5 rounded-md text-sm font-medium`}
              >
                T-Pass Checker
              </button>
              <button
                onClick={() => goto('excel-diff')}
                className={`${view === 'excel-diff' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} px-3 py-1.5 rounded-md text-sm font-medium`}
              >
                Excel Diff
              </button>
            </nav>
          </div>
          <a href={view === 'tpass' ? '#/tpass' : '#/excel-diff'} className="text-xs text-gray-500 hover:text-gray-700">
            {window.location.hash || '#/tpass'}
          </a>
        </div>
      </header>

      {/* Nội dung trang */}
      <main className="flex-1">
        {view === 'tpass' ? <CheckTpass /> : <ExcelChangeTracker />}
      </main>
      <AppFooter />
    </div>
  );
}
