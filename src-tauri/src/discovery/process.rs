use crate::models::{ProcessInfo, ProcessStatus};
use sysinfo::{ProcessRefreshKind, RefreshKind, System};

/// Trait defining the process discovery service abstraction.
/// Enables future multi-platform or mock testing extensions.
pub trait ProcessDiscovery: Send + Sync {
    fn enumerate(&self) -> Result<Vec<ProcessInfo>, String>;
}

/// Windows implementation of process discovery using native system inspection.
pub struct WindowsProcessDiscovery;

impl WindowsProcessDiscovery {
    pub fn new() -> Self {
        Self
    }
}

impl Default for WindowsProcessDiscovery {
    fn default() -> Self {
        Self::new()
    }
}

impl ProcessDiscovery for WindowsProcessDiscovery {
    fn enumerate(&self) -> Result<Vec<ProcessInfo>, String> {
        let refresh_kind = RefreshKind::nothing()
            .with_processes(ProcessRefreshKind::everything());
        let mut sys = System::new_with_specifics(refresh_kind);
        sys.refresh_processes_specifics(sysinfo::ProcessesToUpdate::All, true, ProcessRefreshKind::everything());

        let mut processes = Vec::new();

        for (pid, process) in sys.processes() {
            let pid_u32 = pid.as_u32();
            let parent_pid = process.parent().map(|p| p.as_u32());
            let name = process.name().to_string_lossy().into_owned();

            let executable_path = process
                .exe()
                .map(|p| p.to_string_lossy().into_owned())
                .filter(|s| !s.is_empty());

            let cmd_slice = process.cmd();
            let command_line = if cmd_slice.is_empty() {
                None
            } else {
                let joined = cmd_slice
                    .iter()
                    .map(|s: &std::ffi::OsString| s.to_string_lossy())
                    .collect::<Vec<_>>()
                    .join(" ");
                if joined.trim().is_empty() {
                    None
                } else {
                    Some(joined)
                }
            };

            let working_directory = process
                .cwd()
                .map(|p| p.to_string_lossy().into_owned())
                .filter(|s| !s.is_empty());

            let status = if executable_path.is_none() && command_line.is_none() && pid_u32 != 0 {
                ProcessStatus::AccessRestricted
            } else {
                ProcessStatus::Running
            };

            processes.push(ProcessInfo {
                pid: pid_u32,
                parent_pid,
                name,
                executable_path,
                command_line,
                working_directory,
                status,
                environment: crate::models::environment::Environment::windows(),
            });
        }

        // Sort by PID for stable, predictable ordering from the discovery layer
        processes.sort_by_key(|p| p.pid);

        Ok(processes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_windows_process_discovery_enumerates_real_processes() {
        let discovery = WindowsProcessDiscovery::new();
        let result = discovery.enumerate();

        assert!(result.is_ok(), "Process enumeration should succeed");
        let processes = result.unwrap();

        assert!(!processes.is_empty(), "Should discover running processes on Windows");
        
        // Check for presence of system process or explorer or current runner
        let has_explorer_or_system = processes.iter().any(|p| {
            p.name.eq_ignore_ascii_case("explorer.exe")
                || p.name.eq_ignore_ascii_case("System")
                || p.name.contains("cargo")
                || p.name.contains("runara")
        });

        assert!(
            has_explorer_or_system,
            "Expected common Windows or runner process to be discovered"
        );

        // Ensure all PIDs are valid and PIDs are sorted
        for window in processes.windows(2) {
            assert!(
                window[0].pid <= window[1].pid,
                "Process list should be sorted by PID"
            );
        }
    }
}
