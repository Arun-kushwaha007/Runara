use crate::models::identity::{PackageManager, Runtime};
use crate::models::process::ProcessInfo;

/// Detector responsible for conservatively identifying the software runtime
/// of a process based on process name, executable path, and command line.
pub struct RuntimeDetector;

impl RuntimeDetector {
    /// Conservatively detects the runtime executing the given process.
    /// Returns `Runtime::Unknown` if no high-confidence match is found.
    pub fn detect(process: &ProcessInfo) -> Runtime {
        let name_lower = process.name.to_lowercase();
        let base_name = name_lower.strip_suffix(".exe").unwrap_or(&name_lower);

        // 1. Node.js
        if base_name == "node" || base_name == "nodejs" {
            return Runtime::NodeJs;
        }

        // 2. Python
        if base_name == "python"
            || base_name == "python3"
            || base_name == "pythonw"
            || base_name == "pypy"
            || base_name == "pypy3"
        {
            return Runtime::Python;
        }

        // 3. Java
        if base_name == "java" || base_name == "javaw" {
            return Runtime::Java;
        }

        // 4. .NET
        if base_name == "dotnet" {
            return Runtime::DotNet;
        }

        // 5. Go
        if base_name == "go" {
            return Runtime::Go;
        }

        // 6. Rust toolchain runners
        if base_name == "cargo" || base_name == "cargo-watch" {
            return Runtime::Rust;
        }

        // Check executable path if available for secondary verification
        if let Some(exe_path) = &process.executable_path {
            let exe_lower = exe_path.to_lowercase();
            if exe_lower.ends_with("\\node.exe") || exe_lower.ends_with("/node") {
                return Runtime::NodeJs;
            }
            if exe_lower.ends_with("\\python.exe")
                || exe_lower.ends_with("\\python3.exe")
                || exe_lower.ends_with("/python")
                || exe_lower.ends_with("/python3")
            {
                return Runtime::Python;
            }
            if exe_lower.ends_with("\\java.exe")
                || exe_lower.ends_with("\\javaw.exe")
                || exe_lower.ends_with("/java")
            {
                return Runtime::Java;
            }
            if exe_lower.ends_with("\\dotnet.exe") || exe_lower.ends_with("/dotnet") {
                return Runtime::DotNet;
            }
        }

        Runtime::Unknown
    }
}

/// Detector responsible for identifying package managers (npm, pnpm, yarn, bun)
/// from command line arguments and process ancestry.
pub struct PackageManagerDetector;

impl PackageManagerDetector {
    /// Detects the package manager associated with a process by inspecting its
    /// command line and ancestry chain (parent and ancestors).
    pub fn detect(
        process: &ProcessInfo,
        parent: Option<&ProcessInfo>,
        ancestors: &[&ProcessInfo],
    ) -> PackageManager {
        // Step 1: Check the command line of the target process itself
        if let Some(cmd) = &process.command_line {
            let pm = Self::detect_from_command_line(cmd);
            if pm != PackageManager::Unknown {
                return pm;
            }
        }

        // Step 2: Check the parent process name and command line
        if let Some(p) = parent {
            let pm = Self::detect_from_process(p);
            if pm != PackageManager::Unknown {
                return pm;
            }
        }

        // Step 3: Check upper ancestors (e.g. VS Code -> PowerShell -> npm -> node)
        for ancestor in ancestors {
            let pm = Self::detect_from_process(ancestor);
            if pm != PackageManager::Unknown {
                return pm;
            }
        }

        PackageManager::Unknown
    }

    /// Evaluates a process's name and command line for package manager indicators.
    fn detect_from_process(proc: &ProcessInfo) -> PackageManager {
        let name_lower = proc.name.to_lowercase();
        let base_name = name_lower.strip_suffix(".exe").unwrap_or(&name_lower);
        let base_name = base_name.strip_suffix(".cmd").unwrap_or(base_name);
        let base_name = base_name.strip_suffix(".ps1").unwrap_or(base_name);

        if base_name == "pnpm" || base_name == "pnpx" {
            return PackageManager::Pnpm;
        }
        if base_name == "yarn" {
            return PackageManager::Yarn;
        }
        if base_name == "bun" || base_name == "bunx" {
            return PackageManager::Bun;
        }
        if base_name == "npm" || base_name == "npx" {
            return PackageManager::Npm;
        }

        if let Some(cmd) = &proc.command_line {
            let pm = Self::detect_from_command_line(cmd);
            if pm != PackageManager::Unknown {
                return pm;
            }
        }

        PackageManager::Unknown
    }

    /// Parses command line string for package manager tokens.
    fn detect_from_command_line(cmd: &str) -> PackageManager {
        let cmd_lower = cmd.to_lowercase();

        // Check for PNPM
        if cmd_lower.starts_with("pnpm ")
            || cmd_lower.contains("\\pnpm.cmd")
            || cmd_lower.contains("/pnpm")
            || cmd_lower.contains("pnpm-lock.yaml")
            || cmd_lower.contains("pnpm ")
        {
            return PackageManager::Pnpm;
        }

        // Check for Yarn
        if cmd_lower.starts_with("yarn ")
            || cmd_lower.contains("\\yarn.cmd")
            || cmd_lower.contains("/yarn")
            || cmd_lower.contains("yarn.js")
            || cmd_lower.contains("yarn.lock")
        {
            return PackageManager::Yarn;
        }

        // Check for Bun
        if cmd_lower.starts_with("bun ")
            || cmd_lower.contains("\\bun.exe")
            || cmd_lower.contains("/bun ")
            || cmd_lower.contains("bun run ")
        {
            return PackageManager::Bun;
        }

        // Check for NPM
        if cmd_lower.starts_with("npm ")
            || cmd_lower.starts_with("npx ")
            || cmd_lower.contains("\\npm.cmd")
            || cmd_lower.contains("/npm")
            || cmd_lower.contains("npm-cli.js")
            || cmd_lower.contains("npx.cmd")
        {
            return PackageManager::Npm;
        }

        PackageManager::Unknown
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::process::ProcessStatus;

    fn make_process(
        pid: u32,
        parent_pid: Option<u32>,
        name: &str,
        exe: Option<&str>,
        cmd: Option<&str>,
    ) -> ProcessInfo {
        ProcessInfo {
            pid,
            parent_pid,
            name: name.to_string(),
            executable_path: exe.map(|s| s.to_string()),
            command_line: cmd.map(|s| s.to_string()),
            working_directory: None,
            status: ProcessStatus::Running,
            environment: crate::models::environment::Environment::windows(),
        }
    }

    #[test]
    fn test_runtime_detector_supported_runtimes() {
        let node_proc = make_process(1, None, "node.exe", Some("C:\\nodejs\\node.exe"), None);
        assert_eq!(RuntimeDetector::detect(&node_proc), Runtime::NodeJs);

        let python_proc = make_process(2, None, "python.exe", Some("C:\\Python311\\python.exe"), None);
        assert_eq!(RuntimeDetector::detect(&python_proc), Runtime::Python);

        let python3_proc = make_process(3, None, "python3.exe", None, None);
        assert_eq!(RuntimeDetector::detect(&python3_proc), Runtime::Python);

        let java_proc = make_process(4, None, "java.exe", Some("C:\\Java\\bin\\java.exe"), None);
        assert_eq!(RuntimeDetector::detect(&java_proc), Runtime::Java);

        let dotnet_proc = make_process(5, None, "dotnet.exe", Some("C:\\dotnet\\dotnet.exe"), None);
        assert_eq!(RuntimeDetector::detect(&dotnet_proc), Runtime::DotNet);

        let go_proc = make_process(6, None, "go.exe", None, None);
        assert_eq!(RuntimeDetector::detect(&go_proc), Runtime::Go);

        let cargo_proc = make_process(7, None, "cargo.exe", None, None);
        assert_eq!(RuntimeDetector::detect(&cargo_proc), Runtime::Rust);
    }

    #[test]
    fn test_runtime_detector_unknown() {
        let explorer = make_process(100, None, "explorer.exe", Some("C:\\Windows\\explorer.exe"), None);
        assert_eq!(RuntimeDetector::detect(&explorer), Runtime::Unknown);

        let my_app = make_process(101, None, "my_custom_server.exe", None, None);
        assert_eq!(RuntimeDetector::detect(&my_app), Runtime::Unknown);
    }

    #[test]
    fn test_package_manager_detection_from_command_line() {
        let npm_proc = make_process(10, None, "node.exe", None, Some("npm run dev"));
        assert_eq!(
            PackageManagerDetector::detect(&npm_proc, None, &[]),
            PackageManager::Npm
        );

        let pnpm_proc = make_process(11, None, "node.exe", None, Some("pnpm dev"));
        assert_eq!(
            PackageManagerDetector::detect(&pnpm_proc, None, &[]),
            PackageManager::Pnpm
        );

        let yarn_proc = make_process(12, None, "node.exe", None, Some("yarn dev"));
        assert_eq!(
            PackageManagerDetector::detect(&yarn_proc, None, &[]),
            PackageManager::Yarn
        );

        let bun_proc = make_process(13, None, "bun.exe", None, Some("bun run dev"));
        assert_eq!(
            PackageManagerDetector::detect(&bun_proc, None, &[]),
            PackageManager::Bun
        );

        let plain_node = make_process(14, None, "node.exe", None, Some("node server.js"));
        assert_eq!(
            PackageManagerDetector::detect(&plain_node, None, &[]),
            PackageManager::Unknown
        );
    }

    #[test]
    fn test_package_manager_detection_from_ancestry() {
        let parent_npm = make_process(20, None, "npm.cmd", None, Some("npm run dev"));
        let child_node = make_process(21, Some(20), "node.exe", None, Some("node C:\\path\\vite.js"));

        assert_eq!(
            PackageManagerDetector::detect(&child_node, Some(&parent_npm), &[]),
            PackageManager::Npm
        );

        let grandparent_pnpm = make_process(30, None, "pnpm.cmd", None, Some("pnpm start"));
        let parent_sh = make_process(31, Some(30), "cmd.exe", None, None);
        let child_proc = make_process(32, Some(31), "node.exe", None, Some("node dist/main.js"));

        assert_eq!(
            PackageManagerDetector::detect(&child_proc, Some(&parent_sh), &[&grandparent_pnpm]),
            PackageManager::Pnpm
        );
    }
}
