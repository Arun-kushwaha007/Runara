use crate::models::PortInfo;
use crate::windows::get_windows_listening_tcp_ports;

/// Trait defining the port discovery service abstraction.
/// Enables future multi-platform (WSL, Linux) or mock testing extensions.
pub trait PortDiscovery: Send + Sync {
    fn enumerate(&self) -> Result<Vec<PortInfo>, String>;
}

/// Windows implementation of port discovery using native Win32 IP Helper APIs.
pub struct WindowsPortDiscovery;

impl WindowsPortDiscovery {
    pub fn new() -> Self {
        Self
    }
}

impl Default for WindowsPortDiscovery {
    fn default() -> Self {
        Self::new()
    }
}

impl PortDiscovery for WindowsPortDiscovery {
    fn enumerate(&self) -> Result<Vec<PortInfo>, String> {
        let mut ports = get_windows_listening_tcp_ports()?;

        // Sort deterministically: primary by port, then by address, then by PID
        ports.sort_by(|a, b| {
            a.port
                .cmp(&b.port)
                .then_with(|| a.address.cmp(&b.address))
                .then_with(|| a.pid.cmp(&b.pid))
        });

        // Deduplicate identical endpoints
        ports.dedup();

        Ok(ports)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{ProcessInfo, ProcessStatus};
    use std::collections::HashMap;

    #[test]
    fn test_windows_port_discovery_enumerates_real_listening_ports() {
        let discovery = WindowsPortDiscovery::new();
        let result = discovery.enumerate();

        assert!(result.is_ok(), "Port enumeration should succeed");
        let ports = result.unwrap();

        // Any running Windows machine has active listening services (RPC on 135, etc.)
        assert!(!ports.is_empty(), "Should discover active listening ports on Windows");

        // Verify sorted ordering
        for window in ports.windows(2) {
            let p1 = &window[0];
            let p2 = &window[1];
            assert!(
                p1.port < p2.port
                    || (p1.port == p2.port && p1.address <= p2.address),
                "Ports should be sorted deterministically: {} ({}) vs {} ({})",
                p1.port,
                p1.address,
                p2.port,
                p2.address
            );
        }

        // Verify all entries are TCP and listening
        for p in &ports {
            assert_eq!(p.protocol, "tcp");
            assert_eq!(p.state, "listening");
            assert!(p.port > 0);
        }
    }

    #[test]
    fn test_port_process_hashmap_join_logic() {
        // Sample Process dataset
        let processes = vec![
            ProcessInfo {
                pid: 18240,
                parent_pid: Some(1200),
                name: "node.exe".to_string(),
                executable_path: Some("C:\\nodejs\\node.exe".to_string()),
                command_line: Some("node server.js".to_string()),
                working_directory: Some("C:\\projects\\frontend".to_string()),
                status: ProcessStatus::Running,
                environment: crate::models::environment::Environment::windows(),
            },
            ProcessInfo {
                pid: 19320,
                parent_pid: Some(1200),
                name: "python.exe".to_string(),
                executable_path: Some("C:\\python\\python.exe".to_string()),
                command_line: Some("python app.py".to_string()),
                working_directory: Some("C:\\projects\\backend".to_string()),
                status: ProcessStatus::Running,
                environment: crate::models::environment::Environment::windows(),
            },
        ];

        // Sample Ports dataset (Node owns 3000 & 3001, Python owns 8000, 9999 has missing process)
        let ports = vec![
            PortInfo {
                port: 3000,
                pid: 18240,
                protocol: "tcp".to_string(),
                address: "127.0.0.1".to_string(),
                state: "listening".to_string(),
                environment: crate::models::environment::Environment::windows(),
            },
            PortInfo {
                port: 3001,
                pid: 18240,
                protocol: "tcp".to_string(),
                address: "127.0.0.1".to_string(),
                state: "listening".to_string(),
                environment: crate::models::environment::Environment::windows(),
            },
            PortInfo {
                port: 8000,
                pid: 19320,
                protocol: "tcp".to_string(),
                address: "0.0.0.0".to_string(),
                state: "listening".to_string(),
                environment: crate::models::environment::Environment::windows(),
            },
            PortInfo {
                port: 9000,
                pid: 99999, // Process does not exist or terminated
                protocol: "tcp".to_string(),
                address: "127.0.0.1".to_string(),
                state: "listening".to_string(),
                environment: crate::models::environment::Environment::windows(),
            },
        ];

        // Step 1: Build Process Map O(P)
        let process_map: HashMap<u32, &ProcessInfo> = processes.iter().map(|p| (p.pid, p)).collect();

        // Step 2: Perform join O(S)
        let joined: Vec<(&PortInfo, Option<&ProcessInfo>)> = ports
            .iter()
            .map(|port| (port, process_map.get(&port.pid).copied()))
            .collect();

        assert_eq!(joined.len(), 4);

        // Node.js port 3000
        assert_eq!(joined[0].0.port, 3000);
        assert_eq!(joined[0].1.unwrap().name, "node.exe");

        // Node.js port 3001 (Multiple ports per single process)
        assert_eq!(joined[1].0.port, 3001);
        assert_eq!(joined[1].1.unwrap().name, "node.exe");

        // Python port 8000
        assert_eq!(joined[2].0.port, 8000);
        assert_eq!(joined[2].1.unwrap().name, "python.exe");

        // Missing process for PID 99999
        assert_eq!(joined[3].0.port, 9000);
        assert!(joined[3].1.is_none());
    }
}
