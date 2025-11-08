import React, { useEffect, useState } from 'react';
import CheckTpass from './CheckTpass';
import ExcelChangeTracker from './ExcelChangeTracker';
import AppFooter from './AppFooter';
import UpdateSAC from './UpdateSAC';


// Các route đơn giản qua URL hash
// #/tpass hoặc #/excel-diff

type View = 'tpass' | 'excel-diff' | 'sac';

const getViewFromHash = (): View => {
  const hash = (window.location.hash || '').toLowerCase();
  if (hash.includes('excel')) return 'excel-diff';
  if (hash.includes('sac')) return 'sac';
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
    window.location.hash = v === 'tpass' ? '/tpass' : v === 'excel-diff' ? '/excel-diff' : '/sac';
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
              <button
                onClick={() => goto('sac')}
                className={`${view === 'sac' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} px-3 py-1.5 rounded-md text-sm font-medium`}
              >
                SAC
              </button>
            </nav>
          </div>

        </div>
      </header>

      {/* Nội dung trang */}
      <main className="flex-1">
        {view === 'tpass' ? <CheckTpass /> : view === 'excel-diff' ? <ExcelChangeTracker /> : <UpdateSAC />}
      </main>
      <AppFooter />
    </div>
  );
}
