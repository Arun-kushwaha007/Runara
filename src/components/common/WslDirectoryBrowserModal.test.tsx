import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WslDirectoryBrowserModal } from './WslDirectoryBrowserModal';
import { filesystemApi } from '../../lib/commands';

vi.mock('../../lib/commands', () => ({
  filesystemApi: {
    pickFolder: vi.fn(),
    listWslDirectories: vi.fn(),
    validateDirectory: vi.fn(),
  },
}));

describe('WslDirectoryBrowserModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders directory listing from WSL distribution', async () => {
    vi.mocked(filesystemApi.listWslDirectories).mockResolvedValue({
      currentPath: '/home/developer',
      parentPath: '/home',
      entries: [
        { name: 'api', path: '/home/developer/api', isDirectory: true, isHidden: false },
        { name: 'frontend', path: '/home/developer/frontend', isDirectory: true, isHidden: false },
        { name: '.config', path: '/home/developer/.config', isDirectory: true, isHidden: true },
      ],
    });

    render(
      <WslDirectoryBrowserModal
        isOpen={true}
        distro="Fedora"
        initialPath="/home/developer"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Browse WSL Directory')).toBeInTheDocument();
    expect(screen.getByText('Fedora')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('api')).toBeInTheDocument();
      expect(screen.getByText('frontend')).toBeInTheDocument();
      expect(screen.getByText('.config')).toBeInTheDocument();
    });
  });

  it('navigates to parent directory when Parent button is clicked', async () => {
    vi.mocked(filesystemApi.listWslDirectories)
      .mockResolvedValueOnce({
        currentPath: '/home/developer',
        parentPath: '/home',
        entries: [{ name: 'api', path: '/home/developer/api', isDirectory: true, isHidden: false }],
      })
      .mockResolvedValueOnce({
        currentPath: '/home',
        parentPath: '/',
        entries: [{ name: 'developer', path: '/home/developer', isDirectory: true, isHidden: false }],
      });

    render(
      <WslDirectoryBrowserModal
        isOpen={true}
        distro="Fedora"
        initialPath="/home/developer"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('api')).toBeInTheDocument();
    });

    const parentBtn = screen.getByRole('button', { name: /parent/i });
    fireEvent.click(parentBtn);

    await waitFor(() => {
      expect(filesystemApi.listWslDirectories).toHaveBeenCalledWith('Fedora', '/home');
      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  it('selects current directory when Select Folder button is clicked', async () => {
    vi.mocked(filesystemApi.listWslDirectories).mockResolvedValue({
      currentPath: '/home/developer/api',
      parentPath: '/home/developer',
      entries: [],
    });

    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    render(
      <WslDirectoryBrowserModal
        isOpen={true}
        distro="Fedora"
        initialPath="/home/developer/api"
        onSelect={handleSelect}
        onClose={handleClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('/home/developer/api')).toBeInTheDocument();
    });

    const selectBtn = screen.getByRole('button', { name: /select folder/i });
    fireEvent.click(selectBtn);

    expect(handleSelect).toHaveBeenCalledWith('/home/developer/api');
    expect(handleClose).toHaveBeenCalled();
  });

  it('displays warning when WSL distribution is stopped', async () => {
    vi.mocked(filesystemApi.listWslDirectories).mockRejectedValue(
      "WSL distribution 'Ubuntu' is stopped. Start the distribution before browsing."
    );

    render(
      <WslDirectoryBrowserModal
        isOpen={true}
        distro="Ubuntu"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Ubuntu is currently stopped/i)).toBeInTheDocument();
      expect(screen.getByText(/Start the distribution before browsing/i)).toBeInTheDocument();
    });
  });
});
