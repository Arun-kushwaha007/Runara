use serde::{Deserialize, Serialize};

/// Represents an individual directory entry in a directory listing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryEntry {
    /// Directory base name (e.g. "api" or ".config")
    pub name: String,
    /// Full normalized absolute path in the target environment (e.g. "/home/dev/api" or "C:\Projects\api")
    pub path: String,
    /// Whether this entry is a directory (always true for selectable entries)
    pub is_directory: bool,
    /// Whether this is a hidden directory (starts with '.')
    pub is_hidden: bool,
}

/// Represents the result of listing a directory in a given filesystem.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryListing {
    /// The current absolute path that was listed
    pub current_path: String,
    /// The parent directory path if available (None if at root '/')
    pub parent_path: Option<String>,
    /// Sorted list of subdirectories
    pub entries: Vec<DirectoryEntry>,
}

/// Result of validating a directory path in a given environment.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathValidationResult {
    /// Whether the path is valid, exists, and is an accessible directory
    pub is_valid: bool,
    /// Specific validation error message if invalid
    pub error: Option<String>,
    /// The canonical or normalized path if valid
    pub resolved_path: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_directory_entry_serialization() {
        let entry = DirectoryEntry {
            name: "frontend".to_string(),
            path: "/home/user/frontend".to_string(),
            is_directory: true,
            is_hidden: false,
        };

        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("\"name\":\"frontend\""));
        assert!(json.contains("\"path\":\"/home/user/frontend\""));
        assert!(json.contains("\"isDirectory\":true"));
        assert!(json.contains("\"isHidden\":false"));
    }

    #[test]
    fn test_directory_listing_serialization() {
        let listing = DirectoryListing {
            current_path: "/home/user".to_string(),
            parent_path: Some("/home".to_string()),
            entries: vec![DirectoryEntry {
                name: "projects".to_string(),
                path: "/home/user/projects".to_string(),
                is_directory: true,
                is_hidden: false,
            }],
        };

        let json = serde_json::to_string(&listing).unwrap();
        assert!(json.contains("\"currentPath\":\"/home/user\""));
        assert!(json.contains("\"parentPath\":\"/home\""));
        assert!(json.contains("\"entries\":["));
    }

    #[test]
    fn test_path_validation_result_serialization() {
        let result = PathValidationResult {
            is_valid: true,
            error: None,
            resolved_path: Some("C:\\Projects".to_string()),
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"isValid\":true"));
        assert!(json.contains("\"resolvedPath\":\"C:\\\\Projects\""));
    }
}
