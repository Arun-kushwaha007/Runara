import React, { useState } from 'react';

interface CopyButtonProps {
  textToCopy: string;
  label?: string;
  title?: string;
  className?: string;
  showIconOnly?: boolean;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  textToCopy,
  label = 'Copy',
  title = 'Copy to clipboard',
  className = '',
  showIconOnly = false,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied to clipboard!' : title}
      aria-label={copied ? 'Copied' : title}
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded transition-all duration-150 cursor-pointer select-none ${
        copied
          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
          : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-zinc-100 border border-zinc-700/50 hover:border-zinc-600'
      } ${className}`}
    >
      {copied ? (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-emerald-400 shrink-0"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {!showIconOnly && <span className="font-semibold text-emerald-300">Copied</span>}
        </>
      ) : (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-zinc-400 shrink-0"
          >
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
          {!showIconOnly && <span>{label}</span>}
        </>
      )}
    </button>
  );
};
