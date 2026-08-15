import React from 'react';

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  return (
    <header className="h-14 flex items-center px-6 bg-zinc-800/50 border-b border-zinc-800 shrink-0">
      <h1 className="text-zinc-100 font-medium">{title}</h1>
    </header>
  );
};

export default Header;
