use crate::discovery::{PortDiscovery, ProcessDiscovery, WindowsPortDiscovery, WindowsProcessDiscovery};
use crate::identity::{ProcessIdentityEnricher, ProcessIdentityService};
use crate::models::environment::{
    DiscoveryDiagnostic, UnifiedSnapshot, WslDistribution, WslDistroState,
};
use crate::models::{PortInfo, ProcessInfo};
use crate::wsl::{
    DefaultWslDistroDiscovery, DefaultWslPortDiscovery, DefaultWslProcessDiscovery,
    WslDistroDiscovery, WslPortDiscovery, WslProcessDiscovery,
};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

/// Trait defining unified multi-environment discovery across Windows and WSL.
pub trait UnifiedDiscovery: Send + Sync {
    /// Discovers all processes, ports, identities, distributions, and diagnostics.
    fn discover_all(&self) -> Result<UnifiedSnapshot, String>;
}

/// Service orchestrating discovery across Windows and WSL distributions.
pub struct UnifiedDiscoveryService {
    windows_process_discovery: Arc<dyn ProcessDiscovery>,
    windows_port_discovery: Arc<dyn PortDiscovery>,
    wsl_distro_discovery: Arc<dyn WslDistroDiscovery>,
    wsl_process_discovery: Arc<dyn WslProcessDiscovery>,
    wsl_port_discovery: Arc<dyn WslPortDiscovery>,
    identity_enricher: Arc<dyn ProcessIdentityEnricher>,
}

impl UnifiedDiscoveryService {
    /// Creates a new `UnifiedDiscoveryService` with standard production adapters.
    pub fn new() -> Self {
        Self {
            windows_process_discovery: Arc::new(WindowsProcessDiscovery::new()),
            windows_port_discovery: Arc::new(WindowsPortDiscovery::new()),
            wsl_distro_discovery: Arc::new(DefaultWslDistroDiscovery::new()),
            wsl_process_discovery: Arc::new(DefaultWslProcessDiscovery::new()),
            wsl_port_discovery: Arc::new(DefaultWslPortDiscovery::new()),
            identity_enricher: Arc::new(ProcessIdentityService::new()),
        }
    }

    /// Creates a `UnifiedDiscoveryService` with custom injected adapters for unit and integration testing.
    pub fn with_adapters(
        windows_process_discovery: Arc<dyn ProcessDiscovery>,
        windows_port_discovery: Arc<dyn PortDiscovery>,
        wsl_distro_discovery: Arc<dyn WslDistroDiscovery>,
        wsl_process_discovery: Arc<dyn WslProcessDiscovery>,
        wsl_port_discovery: Arc<dyn WslPortDiscovery>,
        identity_enricher: Arc<dyn ProcessIdentityEnricher>,
    ) -> Self {
        Self {
            windows_process_discovery,
            windows_port_discovery,
            wsl_distro_discovery,
            wsl_process_discovery,
            wsl_port_discovery,
            identity_enricher,
        }
    }
}

impl Default for UnifiedDiscoveryService {
    fn default() -> Self {
        Self::new()
    }
}

impl UnifiedDiscovery for UnifiedDiscoveryService {
    fn discover_all(&self) -> Result<UnifiedSnapshot, String> {
        let mut all_processes: Vec<ProcessInfo> = Vec::new();
        let mut all_ports: Vec<PortInfo> = Vec::new();
        let mut diagnostics: Vec<DiscoveryDiagnostic> = Vec::new();
        let mut distributions: Vec<WslDistribution> = Vec::new();

        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        // --- 1. Windows Discovery ---
        match self.windows_process_discovery.enumerate() {
            Ok(win_procs) => {
                all_processes.extend(win_procs);
            }
            Err(err) => {
                diagnostics.push(DiscoveryDiagnostic {
                    source: "windows".to_string(),
                    distribution: None,
                    operation: "process_discovery".to_string(),
                    error: err,
                    timestamp_ms: now_ms,
                });
            }
        }

        match self.windows_port_discovery.enumerate() {
            Ok(win_ports) => {
                all_ports.extend(win_ports);
            }
            Err(err) => {
                diagnostics.push(DiscoveryDiagnostic {
                    source: "windows".to_string(),
                    distribution: None,
                    operation: "port_discovery".to_string(),
                    error: err,
                    timestamp_ms: now_ms,
                });
            }
        }

        // --- 2. WSL Distribution Discovery ---
        match self.wsl_distro_discovery.enumerate() {
            Ok(distros) => {
                distributions = distros;
            }
            Err(err) => {
                diagnostics.push(DiscoveryDiagnostic {
                    source: "wsl".to_string(),
                    distribution: None,
                    operation: "distro_discovery".to_string(),
                    error: err.to_string(),
                    timestamp_ms: now_ms,
                });
            }
        }

        // --- 3. WSL Per-Distribution Discovery (Running Distros Only) ---
        for distro in &distributions {
            if distro.state != WslDistroState::Running {
                continue;
            }

            // A. WSL Process Discovery
            match self.wsl_process_discovery.enumerate(&distro.name) {
                Ok(wsl_procs) => {
                    all_processes.extend(wsl_procs);
                }
                Err(err) => {
                    diagnostics.push(DiscoveryDiagnostic {
                        source: "wsl".to_string(),
                        distribution: Some(distro.name.clone()),
                        operation: "process_discovery".to_string(),
                        error: err.to_string(),
                        timestamp_ms: now_ms,
                    });
                }
            }

            // B. WSL Listening Port Discovery
            match self.wsl_port_discovery.enumerate(&distro.name) {
                Ok(wsl_ports) => {
                    all_ports.extend(wsl_ports);
                }
                Err(err) => {
                    diagnostics.push(DiscoveryDiagnostic {
                        source: "wsl".to_string(),
                        distribution: Some(distro.name.clone()),
                        operation: "port_discovery".to_string(),
                        error: err.to_string(),
                        timestamp_ms: now_ms,
                    });
                }
            }
        }

        // --- 4. Process Identity Enrichment ---
        let identities = self
            .identity_enricher
            .enrich_processes(&all_processes, &all_ports);

        Ok(UnifiedSnapshot {
            processes: all_processes,
            ports: all_ports,
            identities,
            distributions,
            diagnostics,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::environment::Environment;
    use crate::models::process::ProcessStatus;
    use crate::wsl::executor::WslExecutionError;

    struct MockWindowsProcessDiscovery {
        result: Result<Vec<ProcessInfo>, String>,
    }
    impl ProcessDiscovery for MockWindowsProcessDiscovery {
        fn enumerate(&self) -> Result<Vec<ProcessInfo>, String> {
            self.result.clone()
        }
    }

    struct MockWindowsPortDiscovery {
        result: Result<Vec<PortInfo>, String>,
    }
    impl PortDiscovery for MockWindowsPortDiscovery {
        fn enumerate(&self) -> Result<Vec<PortInfo>, String> {
            self.result.clone()
        }
    }

    struct MockWslDistroDiscovery {
        result: Result<Vec<WslDistribution>, WslExecutionError>,
    }
    impl WslDistroDiscovery for MockWslDistroDiscovery {
        fn enumerate(&self) -> Result<Vec<WslDistribution>, WslExecutionError> {
            self.result.clone()
        }
    }

    struct MockWslProcessDiscovery {
        result: Result<Vec<ProcessInfo>, WslExecutionError>,
    }
    impl WslProcessDiscovery for MockWslProcessDiscovery {
        fn enumerate(&self, _distro: &str) -> Result<Vec<ProcessInfo>, WslExecutionError> {
            self.result.clone()
        }
    }

    struct MockWslPortDiscovery {
        result: Result<Vec<PortInfo>, WslExecutionError>,
    }
    impl WslPortDiscovery for MockWslPortDiscovery {
        fn enumerate(&self, _distro: &str) -> Result<Vec<PortInfo>, WslExecutionError> {
            self.result.clone()
        }
    }

    #[test]
    fn test_unified_discovery_combines_windows_and_wsl() {
        let win_proc = ProcessInfo {
            pid: 18240,
            parent_pid: None,
            name: "node.exe".to_string(),
            executable_path: Some("C:\\nodejs\\node.exe".to_string()),
            command_line: Some("node server.js".to_string()),
            working_directory: Some("C:\\Projects\\frontend".to_string()),
            status: ProcessStatus::Running,
            environment: Environment::windows(),
        };
        let win_port = PortInfo {
            port: 3000,
            pid: 18240,
            protocol: "tcp".to_string(),
            address: "127.0.0.1".to_string(),
            state: "listening".to_string(),
            environment: Environment::windows(),
        };

        let wsl_proc = ProcessInfo {
            pid: 421,
            parent_pid: None,
            name: "node".to_string(),
            executable_path: Some("/usr/bin/node".to_string()),
            command_line: Some("npm run dev".to_string()),
            working_directory: Some("/home/dev/api".to_string()),
            status: ProcessStatus::Running,
            environment: Environment::wsl("Ubuntu"),
        };
        let wsl_port = PortInfo {
            port: 5000,
            pid: 421,
            protocol: "tcp".to_string(),
            address: "0.0.0.0".to_string(),
            state: "listening".to_string(),
            environment: Environment::wsl("Ubuntu"),
        };

        let distro_running = WslDistribution {
            name: "Ubuntu".to_string(),
            state: WslDistroState::Running,
            is_default: true,
            version: Some(2),
        };
        let distro_stopped = WslDistribution {
            name: "Debian".to_string(),
            state: WslDistroState::Stopped,
            is_default: false,
            version: Some(2),
        };

        let service = UnifiedDiscoveryService::with_adapters(
            Arc::new(MockWindowsProcessDiscovery {
                result: Ok(vec![win_proc]),
            }),
            Arc::new(MockWindowsPortDiscovery {
                result: Ok(vec![win_port]),
            }),
            Arc::new(MockWslDistroDiscovery {
                result: Ok(vec![distro_running, distro_stopped]),
            }),
            Arc::new(MockWslProcessDiscovery {
                result: Ok(vec![wsl_proc]),
            }),
            Arc::new(MockWslPortDiscovery {
                result: Ok(vec![wsl_port]),
            }),
            Arc::new(ProcessIdentityService::new()),
        );

        let snapshot = service.discover_all().expect("Discovery should succeed");
        assert_eq!(snapshot.processes.len(), 2);
        assert_eq!(snapshot.ports.len(), 2);
        assert_eq!(snapshot.identities.len(), 2);
        assert_eq!(snapshot.distributions.len(), 2);
        assert!(snapshot.diagnostics.is_empty());

        let win_id = snapshot.identities.iter().find(|i| i.environment.is_windows()).unwrap();
        assert_eq!(win_id.process.pid, 18240);
        assert_eq!(win_id.listening_ports, vec![3000]);

        let wsl_id = snapshot.identities.iter().find(|i| i.environment.is_wsl()).unwrap();
        assert_eq!(wsl_id.process.pid, 421);
        assert_eq!(wsl_id.listening_ports, vec![5000]);
    }

    #[test]
    fn test_unified_discovery_handles_wsl_failure_gracefully() {
        let win_proc = ProcessInfo {
            pid: 1000,
            parent_pid: None,
            name: "app.exe".to_string(),
            executable_path: None,
            command_line: None,
            working_directory: None,
            status: ProcessStatus::Running,
            environment: Environment::windows(),
        };

        let service = UnifiedDiscoveryService::with_adapters(
            Arc::new(MockWindowsProcessDiscovery {
                result: Ok(vec![win_proc]),
            }),
            Arc::new(MockWindowsPortDiscovery {
                result: Ok(vec![]),
            }),
            Arc::new(MockWslDistroDiscovery {
                result: Err(WslExecutionError::WslNotInstalled),
            }),
            Arc::new(MockWslProcessDiscovery {
                result: Ok(vec![]),
            }),
            Arc::new(MockWslPortDiscovery {
                result: Ok(vec![]),
            }),
            Arc::new(ProcessIdentityService::new()),
        );

        let snapshot = service.discover_all().expect("Discovery should still succeed for Windows");
        assert_eq!(snapshot.processes.len(), 1);
        assert_eq!(snapshot.diagnostics.len(), 1);
        assert_eq!(snapshot.diagnostics[0].source, "wsl");
        assert_eq!(snapshot.diagnostics[0].operation, "distro_discovery");
    }

    #[test]
    fn test_live_unified_discovery_service() {
        let service = UnifiedDiscoveryService::new();
        let result = service.discover_all();
        assert!(result.is_ok(), "Live unified discovery must not fail");
        let snapshot = result.unwrap();
        assert!(!snapshot.processes.is_empty(), "Must discover running Windows processes");
        for proc in &snapshot.processes {
            if proc.environment.is_windows() {
                assert!(!proc.name.is_empty());
            }
        }
    }
}
