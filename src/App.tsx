import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Servers from './pages/Servers';
import Profiles from './pages/Profiles';
import Projects from './pages/Projects';
import Settings from './pages/Settings';
import { systemApi } from './lib/commands';
import type { NavPage } from './types';

function App() {
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const checkBackendHealth = async () => {
    setIsInitializing(true);
    setFatalError(null);
    try {
      await systemApi.getSystemInfo();
      setIsInitializing(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFatalError(
        msg ||
          'DevHub could not initialize local storage or start native discovery services. The application cannot safely load your server profiles.'
      );
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    checkBackendHealth();
  }, []);

  if (isInitializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-app-bg text-app-fg">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-500 dark:text-blue-400">
            <svg
              className="animate-spin h-6 w-6 text-blue-500 dark:text-blue-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-app-fg tracking-tight">Initializing DevHub</h1>
            <p className="text-xs text-app-muted-fg mt-1">
              Loading local SQLite database, establishing IPC bridges, and preparing discovery engine...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (fatalError) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-app-bg text-app-fg p-6">
        <div className="max-w-md w-full bg-app-surface border border-red-500/40 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 mx-auto flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <div>
            <h2 className="text-lg font-bold text-red-500 dark:text-red-400">DevHub Initialization Failure</h2>
            <p className="text-xs text-app-muted-fg mt-1.5 leading-relaxed">{fatalError}</p>
          </div>

          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={checkBackendHealth}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg shadow-md transition-colors cursor-pointer"
            >
              Retry Initialization
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard />;
      case 'servers':
        return <Servers />;
      case 'profiles':
        return <Profiles />;
      case 'projects':
        return <Projects />;
      case 'settings':
        return <Settings />;
    }
  };

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      {renderPage()}
    </Layout>
  );
}

export default App;
