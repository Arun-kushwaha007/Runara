use crate::filesystem::windows::WindowsFilesystemProvider;
use crate::filesystem::wsl::WslFilesystemProvider;
use crate::models::environment::Environment;
use crate::models::filesystem::{DirectoryListing, PathValidationResult};
use std::sync::Arc;

/// Service coordinating environment-aware filesystem operations and validations.
pub struct FilesystemService {
    windows_provider: Arc<WindowsFilesystemProvider>,
    wsl_provider: Arc<WslFilesystemProvider>,
}

impl FilesystemService {
    pub fn new() -> Self {
        Self {
            windows_provider: Arc::new(WindowsFilesystemProvider::new()),
            wsl_provider: Arc::new(WslFilesystemProvider::new()),
        }
    }

    pub fn with_providers(
        windows_provider: Arc<WindowsFilesystemProvider>,
        wsl_provider: Arc<WslFilesystemProvider>,
    ) -> Self {
        Self {
            windows_provider,
            wsl_provider,
        }
    }

    /// Validates a working directory path against the target execution environment.
    pub fn validate_directory(
        &self,
        environment: &Environment,
        path: &str,
    ) -> Result<PathValidationResult, String> {
        match environment {
            Environment::Windows => self.windows_provider.validate_directory(path),
            Environment::Wsl { distro } => self.wsl_provider.validate_directory(distro, path),
        }
    }

    /// Lists directories inside the specified WSL distribution at the requested path.
    pub fn list_wsl_directories(
        &self,
        distro: &str,
        path: Option<&str>,
    ) -> Result<DirectoryListing, String> {
        self.wsl_provider.list_directories(distro, path)
    }
}

impl Default for FilesystemService {
    fn default() -> Self {
        Self::new()
    }
}
