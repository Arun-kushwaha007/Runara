import React, { useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import type { NavPage } from '../types';

interface LayoutProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  children: React.ReactNode;
}

const getPageMetadata = (page: NavPage): { title: string; subtitle: string } => {
  switch (page) {
    case 'dashboard':
      return {
        title: 'Dashboard',
        subtitle: 'Unified overview of active local development servers and sockets',
      };
    case 'servers':
      return {
        title: 'Live Servers',
        subtitle: 'All discovered development processes listening across Windows and WSL',
      };
    case 'profiles':
      return {
        title: 'Server Profiles',
        subtitle: 'Saved development server configurations with one-click lifecycle control',
      };
    case 'projects':
      return {
        title: 'Project Groups',
        subtitle: 'Multi-service project orchestration and sequential lifecycle management',
      };
    case 'settings':
      return {
        title: 'Settings & Diagnostics',
        subtitle: 'Host environment telemetry, database persistence health, and engine configuration',
      };
    default:
      return { title: 'DevHub', subtitle: 'Local Development Control Center' };
  }
};

const Layout: React.FC<LayoutProps> = ({ activePage, onNavigate, children }) => {
  const { title, subtitle } = getPageMetadata(activePage);

  // Global navigation keyboard shortcuts (Ctrl+1 through Ctrl+5)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            onNavigate('dashboard');
            break;
          case '2':
            e.preventDefault();
            onNavigate('servers');
            break;
          case '3':
            e.preventDefault();
            onNavigate('profiles');
            break;
          case '4':
            e.preventDefault();
            onNavigate('projects');
            break;
          case '5':
            e.preventDefault();
            onNavigate('settings');
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-app-bg text-app-fg font-sans">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title={title} subtitle={subtitle} />
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
