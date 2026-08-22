import React from 'react';
import { CopyButton } from './CopyButton';

interface TruncatedPathProps {
  path: string;
  maxLength?: number;
  className?: string;
  showCopy?: boolean;
}

/**
 * Truncates a long path in the middle while preserving directory boundaries.
 * Example: C:\Users\developer\Documents\Projects\company\frontend -> C:\Users\developer\...\frontend
 */
export function truncateMiddlePath(path: string, maxLength: number = 40): string {
  if (!path || path.length <= maxLength) {
    return path;
  }

  const isWindows = path.includes('\\');
  const separator = isWindows ? '\\' : '/';
  const parts = path.split(separator);

  if (parts.length <= 2) {
    const half = Math.floor((maxLength - 3) / 2);
    return `${path.slice(0, half)}...${path.slice(-half)}`;
  }

  const prefix = parts[0] ? `${parts[0]}${separator}${parts[1] || ''}` : `${separator}${parts[1] || ''}`;
  const suffix = parts[parts.length - 1] || '';

  if (prefix.length + suffix.length + 5 >= maxLength) {
    const half = Math.floor((maxLength - 3) / 2);
    return `${path.slice(0, half)}...${path.slice(-half)}`;
  }

  return `${prefix}${separator}...${separator}${suffix}`;
}

export const TruncatedPath: React.FC<TruncatedPathProps> = ({
  path,
  maxLength = 42,
  className = '',
  showCopy = true,
}) => {
  if (!path) return <span className="text-zinc-500 italic">None</span>;

  const displayPath = truncateMiddlePath(path, maxLength);
  const isTruncated = displayPath !== path;

  return (
    <div className={`inline-flex items-center gap-1.5 max-w-full group ${className}`}>
      <span
        title={isTruncated ? path : undefined}
        className="font-mono text-xs text-zinc-300 dark:text-zinc-300 truncate select-all"
      >
        {displayPath}
      </span>
      {showCopy && (
        <CopyButton
          textToCopy={path}
          showIconOnly
          title="Copy full path"
          className="opacity-60 group-hover:opacity-100 hover:opacity-100 transition-opacity"
        />
      )}
    </div>
  );
};
