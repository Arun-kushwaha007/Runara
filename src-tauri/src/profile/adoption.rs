use crate::models::environment::Environment;
use crate::models::profile::ServerProfile;
use std::path::Path;

/// Normalizes a filesystem path for consistent comparison across operating systems.
/// Converts backslashes to forward slashes, lowercases, trims trailing slash.
fn normalize_path(path: &str) -> String {
    Path::new(path)
        .to_string_lossy()
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_lowercase()
}

/// Checks whether two profiles are considered duplicates for the purpose of
/// preventing accidental double-adoption of the same server.
///
/// Two profiles are duplicates if ALL of the following match:
/// - Same environment type (and same distro for WSL)
/// - Same normalized working directory
/// - Same command (trimmed)
/// - Same expected port (if both specify one; a profile with no port is NOT a
///   duplicate of one with a specific port, and vice-versa)
///
/// This is intentionally conservative — the goal is to warn the user, not to block.
fn are_profiles_duplicates(a: &ServerProfile, b: &ServerProfile) -> bool {
    // Environment must match
    if std::mem::discriminant(&a.environment) != std::mem::discriminant(&b.environment) {
        return false;
    }

    // WSL distro must match
    if let (Environment::Wsl { distro: da }, Environment::Wsl { distro: db }) =
        (&a.environment, &b.environment)
    {
        if da != db {
            return false;
        }
    }

    // Working directory must match (normalized)
    if normalize_path(&a.working_directory) != normalize_path(&b.working_directory) {
        return false;
    }

    // Command must match (trimmed)
    if a.command.trim() != b.command.trim() {
        return false;
    }

    // Expected port must match (None == None, Some(n) == Some(n))
    if a.expected_port != b.expected_port {
        return false;
    }

    true
}

/// Finds existing profiles that would be considered duplicates of the proposed
/// adoption parameters.
///
/// Returns the subset of `existing_profiles` that match all four criteria:
/// environment, working directory, command, and expected port.
///
/// The result is advisory — the frontend shows a warning and the user decides
/// whether to proceed, use the existing profile, or edit it.
pub fn find_duplicate_profiles(
    environment: &Environment,
    working_directory: &str,
    command: &str,
    expected_port: Option<u16>,
    existing_profiles: &[ServerProfile],
) -> Vec<ServerProfile> {
    let candidate = ServerProfile {
        id: String::new(),
        name: String::new(),
        description: None,
        environment: environment.clone(),
        working_directory: working_directory.to_string(),
        command: command.to_string(),
        expected_port,
        expected_host: None,
        enabled: true,
        created_at: String::new(),
        updated_at: String::new(),
    };

    existing_profiles
        .iter()
        .filter(|p| are_profiles_duplicates(&candidate, p))
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::environment::Environment;

    fn make_profile(
        id: &str,
        environment: Environment,
        working_directory: &str,
        command: &str,
        expected_port: Option<u16>,
    ) -> ServerProfile {
        ServerProfile {
            id: id.to_string(),
            name: "Test Profile".to_string(),
            description: None,
            environment,
            working_directory: working_directory.to_string(),
            command: command.to_string(),
            expected_port,
            expected_host: None,
            enabled: true,
            created_at: "2026-08-22T20:00:00Z".to_string(),
            updated_at: "2026-08-22T20:00:00Z".to_string(),
        }
    }

    #[test]
    fn test_finds_exact_duplicate() {
        let profiles = vec![make_profile(
            "p1",
            Environment::windows(),
            "C:\\Projects\\frontend",
            "npm run dev",
            Some(3000),
        )];

        let result = find_duplicate_profiles(
            &Environment::windows(),
            "C:\\Projects\\frontend",
            "npm run dev",
            Some(3000),
            &profiles,
        );

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, "p1");
    }

    #[test]
    fn test_no_duplicate_when_different_directory() {
        let profiles = vec![make_profile(
            "p1",
            Environment::windows(),
            "C:\\Projects\\frontend",
            "npm run dev",
            Some(3000),
        )];

        let result = find_duplicate_profiles(
            &Environment::windows(),
            "C:\\Projects\\backend",
            "npm run dev",
            Some(3000),
            &profiles,
        );

        assert!(result.is_empty());
    }

    #[test]
    fn test_no_duplicate_when_different_command() {
        let profiles = vec![make_profile(
            "p1",
            Environment::windows(),
            "C:\\Projects\\frontend",
            "npm run dev",
            Some(3000),
        )];

        let result = find_duplicate_profiles(
            &Environment::windows(),
            "C:\\Projects\\frontend",
            "npm start",
            Some(3000),
            &profiles,
        );

        assert!(result.is_empty());
    }

    #[test]
    fn test_no_duplicate_when_different_port() {
        let profiles = vec![make_profile(
            "p1",
            Environment::windows(),
            "C:\\Projects\\frontend",
            "npm run dev",
            Some(3000),
        )];

        let result = find_duplicate_profiles(
            &Environment::windows(),
            "C:\\Projects\\frontend",
            "npm run dev",
            Some(5173),
            &profiles,
        );

        assert!(result.is_empty());
    }

    #[test]
    fn test_no_duplicate_port_mismatch_some_none() {
        let profiles = vec![make_profile(
            "p1",
            Environment::windows(),
            "C:\\Projects\\frontend",
            "npm run dev",
            Some(3000),
        )];

        // Proposed has no port, existing has port — not a duplicate
        let result = find_duplicate_profiles(
            &Environment::windows(),
            "C:\\Projects\\frontend",
            "npm run dev",
            None,
            &profiles,
        );

        assert!(result.is_empty());
    }

    #[test]
    fn test_no_duplicate_when_wsl_distro_differs() {
        let profiles = vec![make_profile(
            "p1",
            Environment::wsl("Ubuntu"),
            "/home/dev/api",
            "npm run dev",
            Some(5000),
        )];

        let result = find_duplicate_profiles(
            &Environment::wsl("Fedora"),
            "/home/dev/api",
            "npm run dev",
            Some(5000),
            &profiles,
        );

        assert!(result.is_empty());
    }

    #[test]
    fn test_finds_wsl_duplicate_same_distro() {
        let profiles = vec![make_profile(
            "p1",
            Environment::wsl("Ubuntu"),
            "/home/dev/api",
            "python -m uvicorn main:app",
            Some(8000),
        )];

        let result = find_duplicate_profiles(
            &Environment::wsl("Ubuntu"),
            "/home/dev/api",
            "python -m uvicorn main:app",
            Some(8000),
            &profiles,
        );

        assert_eq!(result.len(), 1);
    }

    #[test]
    fn test_normalizes_path_for_comparison() {
        let profiles = vec![make_profile(
            "p1",
            Environment::windows(),
            "C:\\Projects\\Frontend",
            "npm run dev",
            Some(3000),
        )];

        // Same path, different casing and slash direction
        let result = find_duplicate_profiles(
            &Environment::windows(),
            "C:/Projects/frontend/",
            "npm run dev",
            Some(3000),
            &profiles,
        );

        assert_eq!(result.len(), 1);
    }

    #[test]
    fn test_returns_all_matching_duplicates() {
        let profiles = vec![
            make_profile(
                "p1",
                Environment::windows(),
                "C:\\Projects\\frontend",
                "npm run dev",
                Some(3000),
            ),
            make_profile(
                "p2",
                Environment::windows(),
                "C:\\Projects\\frontend",
                "npm run dev",
                Some(3000),
            ),
        ];

        let result = find_duplicate_profiles(
            &Environment::windows(),
            "C:\\Projects\\frontend",
            "npm run dev",
            Some(3000),
            &profiles,
        );

        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_empty_profiles_list() {
        let result = find_duplicate_profiles(
            &Environment::windows(),
            "C:\\Projects\\frontend",
            "npm run dev",
            Some(3000),
            &[],
        );

        assert!(result.is_empty());
    }
}
