use crate::models::filesystem::PathValidationResult;
use std::fs;
use std::path::Path;

/// Windows native filesystem operations and validation provider.
pub struct WindowsFilesystemProvider;

impl WindowsFilesystemProvider {
    pub fn new() -> Self {
        Self
    }

    /// Validates a Windows directory path for existence, directory type, and accessibility.
    pub fn validate_directory(&self, path_str: &str) -> Result<PathValidationResult, String> {
        let trimmed = path_str.trim();
        if trimmed.is_empty() {
            return Ok(PathValidationResult {
                is_valid: false,
                error: Some("Working directory cannot be empty.".to_string()),
                resolved_path: None,
            });
        }

        let path = Path::new(trimmed);

        if !path.exists() {
            return Ok(PathValidationResult {
                is_valid: false,
                error: Some(format!(
                    "Directory '{}' does not exist on the Windows file system.",
                    trimmed
                )),
                resolved_path: None,
            });
        }

        if !path.is_dir() {
            return Ok(PathValidationResult {
                is_valid: false,
                error: Some(format!(
                    "Path '{}' is a file, not a valid directory.",
                    trimmed
                )),
                resolved_path: None,
            });
        }

        // Test read accessibility
        match fs::read_dir(path) {
            Ok(_) => {
                // Return normalized path string
                let resolved = path.to_string_lossy().to_string();
                Ok(PathValidationResult {
                    is_valid: true,
                    error: None,
                    resolved_path: Some(resolved),
                })
            }
            Err(e) => Ok(PathValidationResult {
                is_valid: false,
                error: Some(format!(
                    "Unable to access directory '{}': {}",
                    trimmed, e
                )),
                resolved_path: None,
            }),
        }
    }
}

impl Default for WindowsFilesystemProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_validate_empty_path() {
        let provider = WindowsFilesystemProvider::new();
        let res = provider.validate_directory("").unwrap();
        assert!(!res.is_valid);
        assert_eq!(res.error, Some("Working directory cannot be empty.".to_string()));
    }

    #[test]
    fn test_validate_non_existent_path() {
        let provider = WindowsFilesystemProvider::new();
        let res = provider.validate_directory("C:\\DevHubNonExistentPath_XYZ123").unwrap();
        assert!(!res.is_valid);
        assert!(res.error.unwrap().contains("does not exist"));
    }

    #[test]
    fn test_validate_valid_directory() {
        let provider = WindowsFilesystemProvider::new();
        let temp_dir = env::temp_dir();
        let res = provider.validate_directory(&temp_dir.to_string_lossy()).unwrap();
        assert!(res.is_valid);
        assert!(res.error.is_none());
        assert!(res.resolved_path.is_some());
    }

    #[test]
    fn test_validate_file_instead_of_directory() {
        let provider = WindowsFilesystemProvider::new();
        let temp_file = env::temp_dir().join("devhub_test_file.txt");
        fs::write(&temp_file, "test").unwrap();

        let res = provider.validate_directory(&temp_file.to_string_lossy()).unwrap();
        assert!(!res.is_valid);
        assert!(res.error.unwrap().contains("is a file, not a valid directory"));

        let _ = fs::remove_file(temp_file);
    }
}
