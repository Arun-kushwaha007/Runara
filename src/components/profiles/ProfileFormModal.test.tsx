import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProfileFormModal } from './ProfileFormModal';
import { filesystemApi } from '../../lib/commands';
import type { WslDistribution } from '../../types';

vi.mock('../../lib/commands', () => ({
  filesystemApi: {
    pickFolder: vi.fn(),
    listWslDirectories: vi.fn(),
    validateDirectory: vi.fn(),
  },
}));

const mockWslDistros: WslDistribution[] = [
  { name: 'Fedora', state: 'running', isDefault: true, version: 2 },
  { name: 'Ubuntu', state: 'stopped', isDefault: false, version: 2 },
];

describe('ProfileFormModal Integration with WorkingDirectoryField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(filesystemApi.validateDirectory).mockResolvedValue({
      isValid: true,
      error: null,
      resolvedPath: 'C:\\Projects\\my-service',
    });
  });

  it('renders with Windows folder picker by default and submits created profile', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <ProfileFormModal
        wslDistros={mockWslDistros}
        onSave={handleSave}
        onClose={handleClose}
        isSaving={false}
      />
    );

    expect(screen.getByText('Create Server Profile')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse\.\.\./i })).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByLabelText(/server name/i), { target: { value: 'Frontend App' } });
    fireEvent.change(screen.getByLabelText(/working directory/i), {
      target: { value: 'C:\\Projects\\frontend' },
    });
    fireEvent.change(screen.getByLabelText(/startup command/i), {
      target: { value: 'npm run dev' },
    });

    const submitBtn = screen.getByRole('button', { name: /create profile/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith({
        name: 'Frontend App',
        description: null,
        environment: { type: 'windows' },
        workingDirectory: 'C:\\Projects\\frontend',
        command: 'npm run dev',
        expectedPort: null,
        expectedHost: null,
      });
    });
  });

  it('switches to WSL and enables Browse WSL... button for selected distribution', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <ProfileFormModal
        wslDistros={mockWslDistros}
        onSave={handleSave}
        onClose={handleClose}
        isSaving={false}
      />
    );

    // Switch environment to WSL
    const envSelect = screen.getByLabelText(/environment/i);
    fireEvent.change(envSelect, { target: { value: 'wsl' } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /browse wsl\.\.\./i })).toBeInTheDocument();
      expect(screen.getByText(/WSL \(Fedora\)/i)).toBeInTheDocument();
    });
  });
});
