use crate::discovery::{PortDiscovery, ProcessDiscovery, WindowsPortDiscovery, WindowsProcessDiscovery};
use crate::identity::detector::{PackageManagerDetector, RuntimeDetector};
use crate::identity::tree::ProcessTreeBuilder;
use crate::models::{Environment, PortInfo, ProcessIdentity, ProcessInfo};
use std::collections::HashMap;

/// Trait defining the process identity enrichment service abstraction.
pub trait ProcessIdentityEnricher: Send + Sync {
    /// Enriches a batch of raw process snapshots with runtime, package manager,
    /// ancestry trees, and listening port associations.
    fn enrich_processes(
        &self,
        processes: &[ProcessInfo],
        ports: &[PortInfo],
    ) -> Vec<ProcessIdentity>;

    /// Enriches a single process by PID using the provided process and port snapshots.
    fn enrich_process(
        &self,
        pid: u32,
        processes: &[ProcessInfo],
        ports: &[PortInfo],
    ) -> Option<ProcessIdentity>;
}

/// Core service responsible for enriching raw OS process information into
/// developer-oriented ProcessIdentity models.
pub struct ProcessIdentityService;

impl ProcessIdentityService {
    pub fn new() -> Self {
        Self
    }

    /// Orchestrates end-to-end discovery: queries processes and ports from OS,
    /// then enriches them into `ProcessIdentity` structures.
    pub fn discover_all(&self) -> Result<Vec<ProcessIdentity>, String> {
        let process_discovery = WindowsProcessDiscovery::new();
        let port_discovery = WindowsPortDiscovery::new();

        let processes = process_discovery.enumerate()?;
        let ports = port_discovery.enumerate().unwrap_or_default();

        Ok(self.enrich_processes(&processes, &ports))
    }

    /// Discovers and enriches a single target process by PID.
    pub fn discover_by_pid(&self, target_pid: u32) -> Result<Option<ProcessIdentity>, String> {
        let process_discovery = WindowsProcessDiscovery::new();
        let port_discovery = WindowsPortDiscovery::new();

        let processes = process_discovery.enumerate()?;
        let ports = port_discovery.enumerate().unwrap_or_default();

        Ok(self.enrich_process(target_pid, &processes, &ports))
    }
}

impl Default for ProcessIdentityService {
    fn default() -> Self {
        Self::new()
    }
}

impl ProcessIdentityEnricher for ProcessIdentityService {
    fn enrich_processes(
        &self,
        processes: &[ProcessInfo],
        ports: &[PortInfo],
    ) -> Vec<ProcessIdentity> {
        let mut results = Vec::with_capacity(processes.len());

        // Group processes by environment to ensure complete isolation
        let mut env_processes: HashMap<Environment, Vec<&ProcessInfo>> = HashMap::new();
        for proc in processes {
            env_processes.entry(proc.environment.clone()).or_default().push(proc);
        }

        // Group ports by (environment, PID)
        let mut port_map: HashMap<(Environment, u32), Vec<u16>> = HashMap::new();
        for port_info in ports {
            port_map
                .entry((port_info.environment.clone(), port_info.pid))
                .or_default()
                .push(port_info.port);
        }
        for port_list in port_map.values_mut() {
            port_list.sort_unstable();
            port_list.dedup();
        }

        // Process each environment independently
        for (env, env_procs) in env_processes {
            // Build O(P) Process Map scoped strictly to this environment
            let process_map: HashMap<u32, &ProcessInfo> =
                env_procs.iter().map(|p| (p.pid, *p)).collect();

            for proc in env_procs {
                let runtime = RuntimeDetector::detect(proc);
                let parent = ProcessTreeBuilder::resolve_parent(proc, &process_map);
                let ancestors = ProcessTreeBuilder::collect_ancestors(proc, &process_map);
                let parent_proc = proc.parent_pid.and_then(|ppid| process_map.get(&ppid).copied());
                let package_manager =
                    PackageManagerDetector::detect(proc, parent_proc, &ancestors);
                let process_tree = ProcessTreeBuilder::build_tree(proc, &process_map);
                let listening_ports = port_map
                    .get(&(env.clone(), proc.pid))
                    .cloned()
                    .unwrap_or_default();

                results.push(ProcessIdentity {
                    process: proc.clone(),
                    runtime,
                    package_manager,
                    parent,
                    process_tree,
                    listening_ports,
                    environment: env.clone(),
                });
            }
        }

        // Deterministic sort: Windows first, then by distro name, then by PID
        results.sort_by(|a, b| {
            let env_cmp = match (&a.environment, &b.environment) {
                (Environment::Windows, Environment::Windows) => std::cmp::Ordering::Equal,
                (Environment::Windows, Environment::Wsl { .. }) => std::cmp::Ordering::Less,
                (Environment::Wsl { .. }, Environment::Windows) => std::cmp::Ordering::Greater,
                (Environment::Wsl { distro: d1 }, Environment::Wsl { distro: d2 }) => d1.cmp(d2),
            };
            env_cmp.then_with(|| a.process.pid.cmp(&b.process.pid))
        });

        results
    }

    fn enrich_process(
        &self,
        pid: u32,
        processes: &[ProcessInfo],
        ports: &[PortInfo],
    ) -> Option<ProcessIdentity> {
        let target_proc = processes.iter().find(|p| p.pid == pid)?;
        let env = &target_proc.environment;

        let env_procs: Vec<&ProcessInfo> = processes
            .iter()
            .filter(|p| &p.environment == env)
            .collect();
        let process_map: HashMap<u32, &ProcessInfo> =
            env_procs.iter().map(|p| (p.pid, *p)).collect();

        let mut listening_ports: Vec<u16> = ports
            .iter()
            .filter(|p| &p.environment == env && p.pid == pid)
            .map(|p| p.port)
            .collect();
        listening_ports.sort_unstable();
        listening_ports.dedup();

        let runtime = RuntimeDetector::detect(target_proc);
        let parent = ProcessTreeBuilder::resolve_parent(target_proc, &process_map);
        let ancestors = ProcessTreeBuilder::collect_ancestors(target_proc, &process_map);
        let parent_proc = target_proc
            .parent_pid
            .and_then(|ppid| process_map.get(&ppid).copied());
        let package_manager =
            PackageManagerDetector::detect(target_proc, parent_proc, &ancestors);
        let process_tree = ProcessTreeBuilder::build_tree(target_proc, &process_map);

        Some(ProcessIdentity {
            process: target_proc.clone(),
            runtime,
            package_manager,
            parent,
            process_tree,
            listening_ports,
            environment: env.clone(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::identity::{PackageManager, Runtime};
    use crate::models::process::ProcessStatus;

    fn make_process_info(
        pid: u32,
        parent_pid: Option<u32>,
        name: &str,
        exe: Option<&str>,
        cmd: Option<&str>,
        cwd: Option<&str>,
    ) -> ProcessInfo {
        ProcessInfo {
            pid,
            parent_pid,
            name: name.to_string(),
            executable_path: exe.map(|s| s.to_string()),
            command_line: cmd.map(|s| s.to_string()),
            working_directory: cwd.map(|s| s.to_string()),
            status: ProcessStatus::Running,
            environment: Environment::windows(),
        }
    }

    fn make_wsl_process_info(
        distro: &str,
        pid: u32,
        parent_pid: Option<u32>,
        name: &str,
        exe: Option<&str>,
        cmd: Option<&str>,
        cwd: Option<&str>,
    ) -> ProcessInfo {
        ProcessInfo {
            pid,
            parent_pid,
            name: name.to_string(),
            executable_path: exe.map(|s| s.to_string()),
            command_line: cmd.map(|s| s.to_string()),
            working_directory: cwd.map(|s| s.to_string()),
            status: ProcessStatus::Running,
            environment: Environment::wsl(distro),
        }
    }

    #[test]
    fn test_process_identity_service_enrichment_flow() {
        let p_root = make_process_info(1000, None, "Code.exe", Some("C:\\Code\\Code.exe"), None, None);
        let p_shell = make_process_info(
            1100,
            Some(1000),
            "powershell.exe",
            Some("C:\\Windows\\powershell.exe"),
            None,
            None,
        );
        let p_npm = make_process_info(
            1200,
            Some(1100),
            "npm.cmd",
            None,
            Some("npm run dev"),
            Some("C:\\Projects\\frontend"),
        );
        let p_node = make_process_info(
            18240,
            Some(1200),
            "node.exe",
            Some("C:\\Program Files\\nodejs\\node.exe"),
            Some("node C:\\Projects\\frontend\\node_modules\\vite\\bin\\vite.js"),
            Some("C:\\Projects\\frontend"),
        );

        let processes = vec![p_root, p_shell, p_npm, p_node];

        let ports = vec![
            PortInfo {
                port: 3000,
                pid: 18240,
                protocol: "tcp".to_string(),
                address: "127.0.0.1".to_string(),
                state: "listening".to_string(),
                environment: Environment::windows(),
            },
            PortInfo {
                port: 3001,
                pid: 18240,
                protocol: "tcp".to_string(),
                address: "127.0.0.1".to_string(),
                state: "listening".to_string(),
                environment: Environment::windows(),
            },
        ];

        let service = ProcessIdentityService::new();
        let identities = service.enrich_processes(&processes, &ports);

        assert_eq!(identities.len(), 4);

        // Find the node target identity
        let node_id = identities.iter().find(|i| i.process.pid == 18240).unwrap();

        assert_eq!(node_id.runtime, Runtime::NodeJs);
        assert_eq!(node_id.package_manager, PackageManager::Npm);
        assert_eq!(node_id.listening_ports, vec![3000, 3001]);
        assert_eq!(node_id.process.working_directory.as_deref(), Some("C:\\Projects\\frontend"));

        // Check parent info
        let parent = node_id.parent.as_ref().unwrap();
        assert_eq!(parent.pid, 1200);
        assert_eq!(parent.name, "npm.cmd");

        // Check tree
        assert_eq!(node_id.process_tree.len(), 4);
        assert_eq!(node_id.process_tree[0].name, "Code.exe");
        assert_eq!(node_id.process_tree[1].name, "powershell.exe");
        assert_eq!(node_id.process_tree[2].name, "npm.cmd");
        assert_eq!(node_id.process_tree[3].name, "node.exe");
        assert!(node_id.process_tree[3].is_target);
    }

    #[test]
    fn test_cross_environment_pid_isolation() {
        // Windows PID 421 (e.g. some system helper) on port 8080
        let win_proc = make_process_info(421, None, "win_helper.exe", None, None, None);
        let win_port = PortInfo {
            port: 8080,
            pid: 421,
            protocol: "tcp".to_string(),
            address: "127.0.0.1".to_string(),
            state: "listening".to_string(),
            environment: Environment::windows(),
        };

        // WSL / Fedora PID 421 (Node server) on port 3000
        let wsl_proc = make_wsl_process_info(
            "Fedora",
            421,
            Some(300),
            "node",
            Some("/usr/bin/node"),
            Some("npm run dev"),
            Some("/home/dev/api"),
        );
        let wsl_parent = make_wsl_process_info(
            "Fedora",
            300,
            None,
            "bash",
            Some("/bin/bash"),
            Some("-bash"),
            None,
        );
        let wsl_port = PortInfo {
            port: 3000,
            pid: 421,
            protocol: "tcp".to_string(),
            address: "0.0.0.0".to_string(),
            state: "listening".to_string(),
            environment: Environment::wsl("Fedora"),
        };

        let processes = vec![win_proc, wsl_parent, wsl_proc];
        let ports = vec![win_port, wsl_port];

        let service = ProcessIdentityService::new();
        let identities = service.enrich_processes(&processes, &ports);

        assert_eq!(identities.len(), 3);

        let win_id = identities
            .iter()
            .find(|i| i.environment.is_windows() && i.process.pid == 421)
            .unwrap();
        assert_eq!(win_id.listening_ports, vec![8080]);
        assert_eq!(win_id.process.name, "win_helper.exe");

        let wsl_id = identities
            .iter()
            .find(|i| i.environment == Environment::wsl("Fedora") && i.process.pid == 421)
            .unwrap();
        assert_eq!(wsl_id.listening_ports, vec![3000]);
        assert_eq!(wsl_id.runtime, Runtime::NodeJs);
        assert_eq!(wsl_id.package_manager, PackageManager::Npm);
        // Ensure WSL process tree does NOT reference Windows processes
        assert_eq!(wsl_id.process_tree.len(), 2);
        assert_eq!(wsl_id.process_tree[0].name, "bash");
        assert_eq!(wsl_id.process_tree[1].name, "node");
    }

    #[test]
    fn test_process_identity_service_single_process_enrichment() {
        let p_py = make_process_info(
            5000,
            None,
            "python.exe",
            Some("C:\\Python311\\python.exe"),
            Some("python -m uvicorn main:app --port 8000"),
            Some("C:\\Projects\\backend"),
        );

        let ports = vec![PortInfo {
            port: 8000,
            pid: 5000,
            protocol: "tcp".to_string(),
            address: "0.0.0.0".to_string(),
            state: "listening".to_string(),
            environment: Environment::windows(),
        }];

        let service = ProcessIdentityService::new();
        let py_identity = service.enrich_process(5000, &[p_py], &ports);

        assert!(py_identity.is_some());
        let id = py_identity.unwrap();
        assert_eq!(id.runtime, Runtime::Python);
        assert_eq!(id.package_manager, PackageManager::Unknown);
        assert_eq!(id.listening_ports, vec![8000]);
        assert_eq!(id.process_tree.len(), 1);
        assert!(id.process_tree[0].is_target);
    }

    #[test]
    fn test_windows_process_identity_service_live_discovery() {
        let service = ProcessIdentityService::new();
        let result = service.discover_all();

        assert!(result.is_ok(), "Live process identity discovery should succeed");
        let identities = result.unwrap();

        assert!(
            !identities.is_empty(),
            "Should discover and enrich running processes on Windows"
        );

        for id in &identities {
            assert!(!id.process_tree.is_empty(), "Every identity must have at least itself in the tree");
            assert!(id.process_tree.last().unwrap().is_target, "Last node in tree must be the target process");
        }
    }

    #[test]
    fn test_live_server_detection_with_active_tcp_listener() {
        use std::net::TcpListener;
        let listener = TcpListener::bind("127.0.0.1:0").expect("Failed to bind test TCP port");
        let local_port = listener.local_addr().unwrap().port();
        let current_pid = std::process::id();

        let service = ProcessIdentityService::new();
        let identities = service.discover_all().expect("Live discovery should succeed");

        let current_identity = identities.iter().find(|id| id.process.pid == current_pid);
        assert!(current_identity.is_some(), "Current process PID {} must be discovered", current_pid);

        let id = current_identity.unwrap();
        assert!(
            id.listening_ports.contains(&local_port),
            "Discovered listening ports {:?} must contain bound test port {}",
            id.listening_ports,
            local_port
        );
        assert!(!id.process.name.is_empty());
        assert!(!id.process_tree.is_empty());
        assert!(id.process_tree.last().unwrap().is_target);
    }
}

