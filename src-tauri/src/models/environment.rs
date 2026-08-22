use crate::models::identity::ProcessIdentity;
use crate::models::port::PortInfo;
use crate::models::process::ProcessInfo;
use serde::{Deserialize, Serialize};

/// Represents the execution environment of a process or port endpoint.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Environment {
    Windows,
    Wsl { distro: String },
}

impl Environment {
    pub fn windows() -> Self {
        Environment::Windows
    }

    pub fn wsl(distro: impl Into<String>) -> Self {
        Environment::Wsl {
            distro: distro.into(),
        }
    }

    pub fn is_windows(&self) -> bool {
        matches!(self, Environment::Windows)
    }

    pub fn is_wsl(&self) -> bool {
        matches!(self, Environment::Wsl { .. })
    }

    pub fn distro_name(&self) -> Option<&str> {
        match self {
            Environment::Windows => None,
            Environment::Wsl { distro } => Some(distro.as_str()),
        }
    }

    pub fn display_name(&self) -> String {
        match self {
            Environment::Windows => "Windows".to_string(),
            Environment::Wsl { distro } => format!("WSL / {}", distro),
        }
    }
}

impl Default for Environment {
    fn default() -> Self {
        Environment::Windows
    }
}

/// Operational state of a WSL Linux distribution.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WslDistroState {
    Running,
    Stopped,
    Unknown,
    Error,
}

impl std::fmt::Display for WslDistroState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WslDistroState::Running => write!(f, "Running"),
            WslDistroState::Stopped => write!(f, "Stopped"),
            WslDistroState::Unknown => write!(f, "Unknown"),
            WslDistroState::Error => write!(f, "Error"),
        }
    }
}

/// Metadata describing an installed WSL distribution discovered on the Windows host.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WslDistribution {
    pub name: String,
    pub state: WslDistroState,
    pub is_default: bool,
    pub version: Option<u32>,
}

/// Diagnostic record capturing partial failure details during discovery.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryDiagnostic {
    pub source: String,
    pub distribution: Option<String>,
    pub operation: String,
    pub error: String,
    pub timestamp_ms: u64,
}

/// Summary status for a particular execution environment.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentInfo {
    pub environment: Environment,
    pub status: String,
    pub server_count: usize,
}

/// Complete multi-environment discovery snapshot combining Windows and WSL telemetry.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedSnapshot {
    pub processes: Vec<ProcessInfo>,
    pub ports: Vec<PortInfo>,
    pub identities: Vec<ProcessIdentity>,
    pub distributions: Vec<WslDistribution>,
    pub diagnostics: Vec<DiscoveryDiagnostic>,
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_environment_serialization_windows() {
        let env = Environment::windows();
        let json = serde_json::to_string(&env).expect("Failed to serialize");
        assert_eq!(json, "{\"type\":\"windows\"}");

        let deserialized: Environment = serde_json::from_str(&json).expect("Failed to deserialize");
        assert_eq!(deserialized, Environment::Windows);
        assert!(deserialized.is_windows());
        assert!(!deserialized.is_wsl());
        assert_eq!(deserialized.distro_name(), None);
        assert_eq!(deserialized.display_name(), "Windows");
    }

    #[test]
    fn test_environment_serialization_wsl() {
        let env = Environment::wsl("Fedora");
        let json = serde_json::to_string(&env).expect("Failed to serialize");
        assert_eq!(json, "{\"type\":\"wsl\",\"distro\":\"Fedora\"}");

        let deserialized: Environment = serde_json::from_str(&json).expect("Failed to deserialize");
        assert_eq!(deserialized, Environment::Wsl { distro: "Fedora".to_string() });
        assert!(!deserialized.is_windows());
        assert!(deserialized.is_wsl());
        assert_eq!(deserialized.distro_name(), Some("Fedora"));
        assert_eq!(deserialized.display_name(), "WSL / Fedora");
    }

    #[test]
    fn test_wsl_distribution_serialization() {
        let distro = WslDistribution {
            name: "Ubuntu".to_string(),
            state: WslDistroState::Running,
            is_default: true,
            version: Some(2),
        };

        let json = serde_json::to_string(&distro).expect("Failed to serialize");
        assert!(json.contains("\"name\":\"Ubuntu\""));
        assert!(json.contains("\"state\":\"running\""));
        assert!(json.contains("\"isDefault\":true"));
        assert!(json.contains("\"version\":2"));

        let deserialized: WslDistribution = serde_json::from_str(&json).expect("Failed to deserialize");
        assert_eq!(deserialized, distro);
    }
}
