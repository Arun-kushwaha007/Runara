use crate::models::environment::Environment;
use crate::models::process::ProcessInfo;
use serde::{Deserialize, Serialize};

/// Identifies the detected software runtime executing a process.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Runtime {
    #[serde(rename = "Node.js")]
    NodeJs,
    #[serde(rename = "Python")]
    Python,
    #[serde(rename = "Java")]
    Java,
    #[serde(rename = ".NET")]
    DotNet,
    #[serde(rename = "Go")]
    Go,
    #[serde(rename = "Rust")]
    Rust,
    #[serde(rename = "Unknown")]
    Unknown,
}

impl std::fmt::Display for Runtime {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Runtime::NodeJs => write!(f, "Node.js"),
            Runtime::Python => write!(f, "Python"),
            Runtime::Java => write!(f, "Java"),
            Runtime::DotNet => write!(f, ".NET"),
            Runtime::Go => write!(f, "Go"),
            Runtime::Rust => write!(f, "Rust"),
            Runtime::Unknown => write!(f, "Unknown"),
        }
    }
}

/// Identifies the detected package manager managing or launching a process.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PackageManager {
    #[serde(rename = "npm")]
    Npm,
    #[serde(rename = "pnpm")]
    Pnpm,
    #[serde(rename = "yarn")]
    Yarn,
    #[serde(rename = "bun")]
    Bun,
    #[serde(rename = "Unknown")]
    Unknown,
}

impl std::fmt::Display for PackageManager {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PackageManager::Npm => write!(f, "npm"),
            PackageManager::Pnpm => write!(f, "pnpm"),
            PackageManager::Yarn => write!(f, "yarn"),
            PackageManager::Bun => write!(f, "bun"),
            PackageManager::Unknown => write!(f, "Unknown"),
        }
    }
}

/// Information about a process's direct parent process.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessParentInfo {
    pub pid: u32,
    pub name: String,
    pub command_line: Option<String>,
}

/// A node within a reconstructed process ancestry tree.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessTreeNode {
    pub pid: u32,
    pub name: String,
    pub command_line: Option<String>,
    pub is_target: bool,
    pub depth: usize,
}

/// Rich, developer-oriented identity combining process metadata, runtime,
/// package manager, ancestry tree, associated listening network ports, and environment.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessIdentity {
    pub process: ProcessInfo,
    pub runtime: Runtime,
    pub package_manager: PackageManager,
    pub parent: Option<ProcessParentInfo>,
    pub process_tree: Vec<ProcessTreeNode>,
    pub listening_ports: Vec<u16>,
    #[serde(default)]
    pub environment: Environment,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::process::ProcessStatus;

    #[test]
    fn test_runtime_serialization_exact_values() {
        assert_eq!(serde_json::to_string(&Runtime::NodeJs).unwrap(), "\"Node.js\"");
        assert_eq!(serde_json::to_string(&Runtime::Python).unwrap(), "\"Python\"");
        assert_eq!(serde_json::to_string(&Runtime::Java).unwrap(), "\"Java\"");
        assert_eq!(serde_json::to_string(&Runtime::DotNet).unwrap(), "\".NET\"");
        assert_eq!(serde_json::to_string(&Runtime::Go).unwrap(), "\"Go\"");
        assert_eq!(serde_json::to_string(&Runtime::Rust).unwrap(), "\"Rust\"");
        assert_eq!(serde_json::to_string(&Runtime::Unknown).unwrap(), "\"Unknown\"");
    }

    #[test]
    fn test_package_manager_serialization_exact_values() {
        assert_eq!(serde_json::to_string(&PackageManager::Npm).unwrap(), "\"npm\"");
        assert_eq!(serde_json::to_string(&PackageManager::Pnpm).unwrap(), "\"pnpm\"");
        assert_eq!(serde_json::to_string(&PackageManager::Yarn).unwrap(), "\"yarn\"");
        assert_eq!(serde_json::to_string(&PackageManager::Bun).unwrap(), "\"bun\"");
        assert_eq!(serde_json::to_string(&PackageManager::Unknown).unwrap(), "\"Unknown\"");
    }

    #[test]
    fn test_process_identity_serialization_camel_case() {
        let identity = ProcessIdentity {
            process: ProcessInfo {
                pid: 18240,
                parent_pid: Some(17820),
                name: "node.exe".to_string(),
                executable_path: Some("C:\\Program Files\\nodejs\\node.exe".to_string()),
                command_line: Some("npm run dev".to_string()),
                working_directory: Some("C:\\Projects\\company-frontend".to_string()),
                status: ProcessStatus::Running,
                environment: Environment::windows(),
            },
            runtime: Runtime::NodeJs,
            package_manager: PackageManager::Npm,
            parent: Some(ProcessParentInfo {
                pid: 17820,
                name: "npm.cmd".to_string(),
                command_line: Some("npm run dev".to_string()),
            }),
            process_tree: vec![
                ProcessTreeNode {
                    pid: 16300,
                    name: "Code.exe".to_string(),
                    command_line: None,
                    is_target: false,
                    depth: 0,
                },
                ProcessTreeNode {
                    pid: 17120,
                    name: "powershell.exe".to_string(),
                    command_line: None,
                    is_target: false,
                    depth: 1,
                },
                ProcessTreeNode {
                    pid: 17820,
                    name: "npm.cmd".to_string(),
                    command_line: Some("npm run dev".to_string()),
                    is_target: false,
                    depth: 2,
                },
                ProcessTreeNode {
                    pid: 18240,
                    name: "node.exe".to_string(),
                    command_line: Some("npm run dev".to_string()),
                    is_target: true,
                    depth: 3,
                },
            ],
            listening_ports: vec![3000, 3001],
            environment: Environment::windows(),
        };

        let json = serde_json::to_string(&identity).expect("Failed to serialize ProcessIdentity");
        assert!(json.contains("\"packageManager\":\"npm\""));
        assert!(json.contains("\"runtime\":\"Node.js\""));
        assert!(json.contains("\"processTree\":["));
        assert!(json.contains("\"isTarget\":true"));
        assert!(json.contains("\"listeningPorts\":[3000,3001]"));
        assert!(json.contains("\"parent\":{\"pid\":17820,\"name\":\"npm.cmd\""));
        assert!(json.contains("\"environment\":{\"type\":\"windows\"}"));

        let deserialized: ProcessIdentity =
            serde_json::from_str(&json).expect("Failed to deserialize ProcessIdentity");
        assert_eq!(deserialized, identity);
    }
}
