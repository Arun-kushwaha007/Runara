# DevHub Release Notes — Version 0.1.0 (MVP Release)

```
Release Version:     0.1.0 (Initial MVP Release)
Release Date:        2026-08-23
Target Operating OS: Windows 10 / Windows 11 (64-bit)
Supported Envs:      Windows Host + WSL 2 (Windows Subsystem for Linux)
Architecture:        Tauri 2 + Rust Native Backend + React 19 / TypeScript / Vite
```

---

## 🌟 What is DevHub?

DevHub is a native Windows desktop application that gives developers a centralized control center for their local development servers across Windows and WSL.

When running multiple frontend applications, backend services, workers, and AI coding agents, developers often struggle to identify which process owns a port, which terminal started a service, or how to safely restart conflicting servers. DevHub solves visibility and control without terminal hunting or PID lookups.

---

## 🚀 Key Features in MVP v0.1.0

### 1. Multi-Environment Discovery
- **Sub-millisecond TCP Socket Discovery**: Uses the native Win32 IP Helper API (`GetExtendedTcpTable`) to enumerate all active listening ports across IPv4, IPv6, and wildcard addresses.
- **WSL 2 Distribution Integration**: Automatically discovers running WSL Linux distributions (Ubuntu, Debian, Fedora, Arch) and inspects Linux sockets (`ss`) and processes (`ps`).
- **$O(P + S)$ Map Join**: High-performance association of listening ports with parent processes.

### 2. Process Identity & Lineage
- **9-Dimensional Process Identity**: Classifies runtimes (`Node.js`, `Python`, `Rust`, `.NET`, `Go`, `Java`) and package managers (`npm`, `pnpm`, `yarn`, `bun`, `cargo`).
- **Ancestry Tree Visualizer**: Visualizes process trees with cycle protection ($D \le 32$) to disambiguate child servers from parent shells.
- **Smart Naming Heuristics**: Resolves developer-friendly project names from workspace directories.

### 3. Safe Cross-Environment Process Control (Windows & WSL)
- **7-Signal Pre-Termination Verification**: Mitigates TOCTOU and PID-reuse vulnerabilities before signaling or terminating processes.
- **POSIX Signal Architecture for WSL**: Sends graceful `SIGTERM` (15) and uncatchable `SIGKILL` (9) via structured argument vectors directly to `/bin/kill` inside Linux distributions (no unescaped shell strings).
- **Ancestor Protection Rule**: Guarantees parent shells (`pwsh.exe`, `cmd.exe`, `bash`, `zsh`) and IDEs (`Code.exe`, IDE server) are never terminated.
- **Descendant Tree Discovery**: Leaf-to-root BFS traversal terminates worker child processes before terminating parent processes.
- **Post-Termination Port Verification**: Confirms port release or reports diagnostic notices if the port was rebound by another process (`PortOwnerChanged`).

### 4. Server Profiles & Startup Subsystem
- **Persistent Server Profiles**: Store startup commands, working directories, environments, and expected ports in an embedded SQLite database (WAL mode).
- **Cross-Environment Launchers & Restarts**: One-click launching and live restart across both Windows and WSL distributions.
- **Pre-Flight Port Conflict Protection**: Prevents collisions if a port is already in use and reveals live occupant metadata.
- **Safe Restart Flow**: Stop &rarr; verify release &rarr; fresh launch with non-blocking readiness polling.

### 5. Adopt Unknown Servers
- **Multi-Signal Heuristic Matching**: Detects unmanaged live servers and synthesizes transient adoption drafts for instant profile creation.

### 6. Project Groups & Sequential Orchestration
- **Sequential Startup Engine**: Spawns multi-service development projects in defined order with fail-fast safety.
- **Reverse-Order Teardown**: Gracefully tears down services in reverse startup order across both Windows and WSL.
- **Cross-Environment Project Restart**: Full teardown and restart orchestration across mixed Windows and WSL project stacks.
- **Dynamic 8-Tier Runtime State**: Calculates aggregated project health (`Running`, `Partial`, `Stopped`, `Error`) from live process telemetry without stale database flags.
- **Concurrency Locks**: Prevents duplicate in-flight operations on the same project or server PID.

### 7. Polished Developer UX & Settings
- **5-View Navigation**: Dashboard, Live Servers, Server Profiles, Project Groups, Settings.
- **Global Keyboard Shortcuts**: `Ctrl+1..5` navigation, `Ctrl+R` refresh, `Esc` modal dismiss.
- **Live System Telemetry**: Settings panel displaying host architecture, WSL distribution status, SQLite WAL health, and polling frequency options.

---

## 💻 System Requirements

- **OS**: Windows 10 (Build 19041+) or Windows 11 (64-bit)
- **Runtime**: Microsoft Edge WebView2 (pre-installed on modern Windows)
- **Optional**: WSL 2 with at least one active Linux distribution for WSL inspection.

---

## 🔮 Roadmap Beyond MVP

- Real-time event-driven socket monitoring via ETW (Event Tracing for Windows)
- Native system tray minimize and quick status menu
- Deep container inspection (Docker Desktop / Podman container integration)
- Log streaming and terminal output viewer per server profile
- Custom environment variable management per project group
