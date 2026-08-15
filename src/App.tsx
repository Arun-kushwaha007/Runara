import { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Servers from './pages/Servers';
import Projects from './pages/Projects';
import Settings from './pages/Settings';
import type { NavPage } from './types';

function App() {
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  
  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard />;
      case 'servers': return <Servers />;
      case 'projects': return <Projects />;
      case 'settings': return <Settings />;
    }
  };
  
  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      {renderPage()}
    </Layout>
  );
}

export default App;
