import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import type { NavPage } from '../types';

interface LayoutProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  children: React.ReactNode;
}

const getTitleForPage = (page: NavPage): string => {
  switch (page) {
    case 'dashboard': return 'Dashboard';
    case 'servers': return 'Servers';
    case 'projects': return 'Projects';
    case 'settings': return 'Settings';
    default: return 'DevHub';
  }
};

const Layout: React.FC<LayoutProps> = ({ activePage, onNavigate, children }) => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-950 text-zinc-100">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      
      <main className="flex-1 flex flex-col min-w-0">
        <Header title={getTitleForPage(activePage)} />
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
