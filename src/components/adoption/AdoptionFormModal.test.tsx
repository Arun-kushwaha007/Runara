import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdoptionFormModal } from './AdoptionFormModal';
import { filesystemApi, profileApi } from '../../lib/commands';
import type { DashboardServer } from '../../types';

vi.mock('../../lib/commands', () => ({
  filesystemApi: {
    pickFolder: vi.fn(),
    listWslDirectories: vi.fn(),
    validateDirectory: vi.fn(),
  },
  profileApi: {
    findDuplicates: vi.fn().mockResolvedValue({ hasDuplicates: false, duplicates: [] }),
  },
}));

const mockServer: DashboardServer = {
  id: 'win-18240-3000',
  name: 'my-frontend',
  status: 'running',
  primaryPort: 3000,
  allPorts: [3000],
  address: '127.0.0.1',
  protocol: 'tcp',
  pid: 18240,
  processName: 'node.exe',
  executablePath: 'C:\\Program Files\\nodejs\\node.exe',
  commandLine: 'node server.js',
  workingDirectory: 'C:\\Projects\\my-frontend',
  runtime: 'Node.js',
  packageManager: 'npm',
  parent: null,
  processTree: [],
  environment: { type: 'windows' },
  environmentLabel: 'Windows',
  managed: false,
};

describe('AdoptionFormModal Integration with WorkingDirectoryField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(filesystemApi.validateDirectory).mockResolvedValue({
      isValid: true,
      error: null,
      resolvedPath: 'C:\\Projects\\my-frontend',
    });
    vi.mocked(profileApi.findDuplicates).mockResolvedValue({
      hasDuplicates: false,
      duplicates: [],
    });
  });

  it('renders prefilled working directory with Browse button and submits adoption', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <AdoptionFormModal
        server={mockServer}
        onSave={handleSave}
        onClose={handleClose}
        isSaving={false}
      />
    );

    expect(screen.getByText('Adopt Running Server')).toBeInTheDocument();
    const input = screen.getByLabelText(/working directory/i);
    expect((input as HTMLInputElement).value).toBe('C:\\Projects\\my-frontend');
    expect(screen.getByRole('button', { name: /browse\.\.\./i })).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /save profile/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          workingDirectory: 'C:\\Projects\\my-frontend',
          environment: { type: 'windows' },
        })
      );
    });
  });

  it('allows browsing to select a different directory during adoption', async () => {
    vi.mocked(filesystemApi.pickFolder).mockResolvedValue('C:\\Projects\\custom-root');
    vi.mocked(filesystemApi.validateDirectory).mockResolvedValue({
      isValid: true,
      error: null,
      resolvedPath: 'C:\\Projects\\custom-root',
    });

    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <AdoptionFormModal
        server={mockServer}
        onSave={handleSave}
        onClose={handleClose}
        isSaving={false}
      />
    );

    const browseBtn = screen.getByRole('button', { name: /browse\.\.\./i });
    fireEvent.click(browseBtn);

    await waitFor(() => {
      expect(filesystemApi.pickFolder).toHaveBeenCalled();
      const input = screen.getByLabelText(/working directory/i);
      expect((input as HTMLInputElement).value).toBe('C:\\Projects\\custom-root');
    });
  });
});
