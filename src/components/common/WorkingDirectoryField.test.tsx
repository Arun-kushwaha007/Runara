import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkingDirectoryField } from './WorkingDirectoryField';
import { filesystemApi } from '../../lib/commands';

vi.mock('../../lib/commands', () => ({
  filesystemApi: {
    pickFolder: vi.fn(),
    listWslDirectories: vi.fn(),
    validateDirectory: vi.fn(),
  },
}));

describe('WorkingDirectoryField Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(filesystemApi.validateDirectory).mockResolvedValue({
      isValid: true,
      error: null,
      resolvedPath: 'C:\\Projects\\app',
    });
  });

  it('renders Windows environment with Browse... button', async () => {
    const handleChange = vi.fn();
    render(
      <WorkingDirectoryField
        environment={{ type: 'windows' }}
        value="C:\Projects\app"
        onChange={handleChange}
      />
    );

    expect(screen.getByText(/Working Directory/i)).toBeInTheDocument();
    expect(screen.getByText('Windows Host')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse\.\.\./i })).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    expect((input as HTMLInputElement).value).toBe('C:\\Projects\\app');
  });

  it('renders WSL environment with Browse WSL... button and distro badge', () => {
    const handleChange = vi.fn();
    render(
      <WorkingDirectoryField
        environment={{ type: 'wsl', distro: 'Fedora' }}
        value="/home/dev/api"
        onChange={handleChange}
      />
    );

    expect(screen.getByText('WSL (Fedora)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse wsl\.\.\./i })).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    expect((input as HTMLInputElement).value).toBe('/home/dev/api');
  });

  it('calls pickFolder on Windows Browse click and updates value', async () => {
    vi.mocked(filesystemApi.pickFolder).mockResolvedValue('C:\\Projects\\selected-folder');
    vi.mocked(filesystemApi.validateDirectory).mockResolvedValue({
      isValid: true,
      error: null,
      resolvedPath: 'C:\\Projects\\selected-folder',
    });

    const handleChange = vi.fn();
    render(
      <WorkingDirectoryField
        environment={{ type: 'windows' }}
        value=""
        onChange={handleChange}
      />
    );

    const browseBtn = screen.getByRole('button', { name: /browse\.\.\./i });
    fireEvent.click(browseBtn);

    await waitFor(() => {
      expect(filesystemApi.pickFolder).toHaveBeenCalled();
      expect(handleChange).toHaveBeenCalledWith('C:\\Projects\\selected-folder');
    });
  });

  it('clears directory path when Clear button is clicked', () => {
    const handleChange = vi.fn();
    render(
      <WorkingDirectoryField
        environment={{ type: 'windows' }}
        value="C:\Projects\app"
        onChange={handleChange}
      />
    );

    const clearBtn = screen.getByRole('button', { name: /clear path/i });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(handleChange).toHaveBeenCalledWith('');
  });

  it('shows validation error when path does not exist on blur', async () => {
    vi.mocked(filesystemApi.validateDirectory).mockResolvedValue({
      isValid: false,
      error: "Directory 'C:\\Projects\\missing' does not exist.",
      resolvedPath: null,
    });

    const handleChange = vi.fn();
    render(
      <WorkingDirectoryField
        environment={{ type: 'windows' }}
        value="C:\Projects\missing"
        onChange={handleChange}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.blur(input);

    await waitFor(() => {
      expect(
        screen.getByText(/Directory 'C:\\Projects\\missing' does not exist/i)
      ).toBeInTheDocument();
    });
  });
});
