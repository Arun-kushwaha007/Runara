import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TruncatedPath, truncateMiddlePath } from './TruncatedPath';

describe('truncateMiddlePath utility', () => {
  it('does not truncate paths shorter than maxLength', () => {
    expect(truncateMiddlePath('C:\\Projects', 40)).toBe('C:\\Projects');
    expect(truncateMiddlePath('/home/user/api', 40)).toBe('/home/user/api');
  });

  it('truncates long Windows paths in the middle', () => {
    const longWinPath = 'C:\\Users\\developer\\Documents\\Projects\\company\\frontend\\development';
    const truncated = truncateMiddlePath(longWinPath, 35);
    expect(truncated).toContain('...');
    expect(truncated.startsWith('C:\\Users')).toBe(true);
    expect(truncated.endsWith('development')).toBe(true);
  });

  it('truncates long Linux/WSL paths in the middle', () => {
    const longLinuxPath = '/home/developer/workspace/infrastructure/services/authentication/api';
    const truncated = truncateMiddlePath(longLinuxPath, 35);
    expect(truncated).toContain('...');
    expect(truncated.startsWith('/home')).toBe(true);
    expect(truncated.endsWith('api')).toBe(true);
  });
});

describe('TruncatedPath component', () => {
  it('renders None when path is empty', () => {
    render(<TruncatedPath path="" />);
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('renders short path completely without truncation', () => {
    render(<TruncatedPath path="/home/developer/app" />);
    expect(screen.getByText('/home/developer/app')).toBeInTheDocument();
  });

  it('renders copy button for full path', () => {
    render(<TruncatedPath path="C:\\Projects\\very\\long\\path\\to\\my\\project" maxLength={20} />);
    const copyBtn = screen.getByTitle('Copy full path');
    expect(copyBtn).toBeInTheDocument();
  });
});
