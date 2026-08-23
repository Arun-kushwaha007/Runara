import React from 'react';

export interface ToastMessage {
  id?: string;
  type: 'success' | 'warning' | 'info' | 'error';
  message: string;
  details?: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  if (!toast) return null;

  const getStyle = () => {
    switch (toast.type) {
      case 'success':
        return {
          container: 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-700/60 text-emerald-950 dark:text-emerald-100 shadow-emerald-950/10 dark:shadow-emerald-950/50',
          iconColor: 'text-emerald-600 dark:text-emerald-400',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ),
        };
      case 'warning':
        return {
          container: 'bg-amber-50 dark:bg-amber-950/90 border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-100 shadow-amber-950/10 dark:shadow-amber-950/50',
          iconColor: 'text-amber-600 dark:text-amber-400',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ),
        };
      case 'error':
        return {
          container: 'bg-red-50 dark:bg-red-950/90 border-red-300 dark:border-red-700/60 text-red-950 dark:text-red-100 shadow-red-950/10 dark:shadow-red-950/50',
          iconColor: 'text-red-600 dark:text-red-400',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          ),
        };
      case 'info':
      default:
        return {
          container: 'bg-blue-50 dark:bg-blue-950/90 border-blue-300 dark:border-blue-700/60 text-blue-950 dark:text-blue-100 shadow-blue-950/10 dark:shadow-blue-950/50',
          iconColor: 'text-blue-600 dark:text-blue-400',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          ),
        };
    }
  };

  const style = getStyle();

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <div className={`flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md ${style.container}`}>
        <div className={`shrink-0 mt-0.5 ${style.iconColor}`}>
          {style.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-snug break-words">
            {toast.message}
          </p>
          {toast.details && (
            <p className="text-[11px] opacity-85 mt-0.5 leading-relaxed break-words font-mono">
              {toast.details}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1 rounded-md opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-all cursor-pointer"
          title="Dismiss notification"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
};
