import React from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <header className="h-14 flex items-center justify-between px-6 bg-app-surface/80 border-b border-app-border shrink-0 backdrop-blur-xs select-none">
      {/* Location / Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 text-xs text-app-muted-fg font-medium">
          <span>Runara</span>
          <span>/</span>
          <span className="text-app-fg font-semibold">{title}</span>
        </div>
        {subtitle && (
          <span className="hidden md:inline-block text-xs text-app-muted-fg truncate border-l border-app-border pl-3">
            {subtitle}
          </span>
        )}
      </div>

      {/* Right side status / refresh indicator */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-app-muted border border-app-border text-[11px] text-app-muted-fg">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>Windows + WSL Control Center</span>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg text-app-muted-fg hover:text-app-fg hover:bg-app-surface-hover transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh current view (Ctrl+R / F5)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isRefreshing ? 'animate-spin' : ''}
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
