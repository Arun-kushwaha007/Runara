# DevHub Release Notes — Version 0.1.0 (First Public Release)

```
Product Name:        DevHub
Release Version:     0.1.0
Release Date:        2026-08-23
Target Operating OS: Windows 10 (Build 19041+) / Windows 11 (64-bit)
Supported Envs:      Windows Host + WSL 2 (Ubuntu, Debian, Fedora, Arch)
Architecture:        Tauri 2 + Native Rust Backend + React 19 / TypeScript 5.8
```

---

## 🌟 What is DevHub?

**DevHub** is a native Windows desktop application that gives developers a centralized control center for local development servers across Windows and WSL.

Modern software developers frequently run 5 to 15 concurrent local services: Next.js frontend applications, Express or FastAPI microservices, Python ML servers, background workers, and ephemeral servers spawned by AI coding agents. Managing these servers across multiple terminal tabs, VS Code windows, and WSL distributions leads to constant friction with port conflicts, orphaned processes, and blind process hunting.

DevHub solves visibility and control by building a high-performance management plane above the operating system kernel.

---

## 📦 Distribution Packages & SHA-256 Checksums

The production release artifacts are standalone binaries and installers that run independently on Windows without requiring Node.js, Rust, or development dependencies:

| Artifact | File Name | Size | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| **Windows NSIS Installer** | `DevHub_0.1.0_x64-setup.exe` | 3.44 MB | `E5968CA0038B8BF357C8776A38AA2E2B0F0253D822F877042894589DB15C6396` |
| **Windows MSI Package** | `DevHub_0.1.0_x64_en-US.msi` | 4.69 MB | `1B71E775C965DA0517A770FBF427FE8BA9ED4F3A01CF689D1947BFD480A95ED7` |
| **Standalone Executable** | `DevHub.exe` | 8.19 MB | `484888649807E1E8C18F66FCE727D78D50DDF80AA0BC28A06075B2A39F854462` |

---

## 🚀 Key Features in v0.1.0

### 1. Multi-Environment Discovery
- **Sub-Millisecond Win32 Sockets**: Direct FFI queries to the Win32 IP Helper API (`GetExtendedTcpTable`) in kernel memory to enumerate listening sockets across IPv4, IPv6, and wildcard bindings.
- **WSL 2 Guest Discovery**: Automated enumeration of active WSL Linux distributions (Ubuntu, Debian, Fedora, Arch), parsing guest sockets (`ss`) and processes (`ps`).
- **High-Performance Map Join**: Associates listening sockets with parent processes in $O(P + S)$ algorithmic time complexity.

### 2. Process Identity & Lineage
- **9-Dimensional Process Classifier**: Identifies runtimes (`Node.js`, `Python`, `Rust`, `.NET`, `Go`, `Java`) and package managers (`npm`, `pnpm`, `yarn`, `bun`, `cargo`).
- **Ancestry Tree Visualizer**: Visualizes process lineages with cycle protection ($D \le 32$) to disambiguate child servers from parent shells.
- **Human-Friendly Workspace Resolution**: Automatically derives project names from repository root folders.

### 3. Safe Cross-Environment Process Control
- **7-Signal Verification Gate**: Validates PID, process name, command, executable path, and working directory prior to signaling to eliminate TOCTOU and PID reuse risks.
- **Ancestor Guardrails**: Protects parent shells (`pwsh.exe`, `cmd.exe`, `bash`, `zsh`) and IDEs (`Code.exe`) from accidental termination.
- **POSIX Signal Engine for WSL**: Sends structured argument vectors directly to `/bin/kill` with graceful `SIGTERM` (15) and uncatchable `SIGKILL` (9).
- **Post-Termination Port Verification**: Confirms socket release or reports diagnostic notices if the port was rebound by another process (`PortOwnerChanged`).

### 4. Native Filesystem Integration
- **Win32 Folder Dialog**: Native Windows directory picker dialog via `@tauri-apps/plugin-dialog`.
- **WSL Guest Directory Browser**: Live, interactive guest filesystem explorer with parent navigation, hidden folder toggling, and directory validation.

### 5. Server Profiles & Startup Subsystem
- **Persistent Repeatable Configurations**: Embedded SQLite database (WAL mode) storing commands, working directories, environments, and expected ports.
- **Pre-Flight Port Conflict Protection**: Detects and displays active port occupants before attempting launch, preventing startup crashes.
- **Non-Blocking Readiness Polling**: Asynchronous socket polling confirms when the server is actively listening.

### 6. Unknown Server Adoption Flow
- **Multi-Signal Heuristic Matching**: Detects unmanaged live servers and synthesizes transient adoption drafts for instant profile enrollment with visual path correction.

### 7. Multi-Service Projects & Orchestration
- **Declarative Desired-State Startup**: Sequentially starts project microservices in defined order, skipping already-healthy services with fail-fast stopping.
- **Safe Reverse-Order Teardown**: Gracefully shuts down services in reverse sequence across mixed Windows and WSL environments.
- **Cross-Environment Project Restart**: Full teardown and sequential rebuild across mixed stacks.
- **Dynamic 8-Tier Runtime Health**: Derives aggregated project status (`Running`, `Partial`, `Stopped`, `Error`) from live process telemetry.
- **Concurrency Locks**: In-memory mutex guards prevent race conditions and duplicate operations.

### 8. Semantic Dual-Theme Engine & Settings
- **Dark Theme Palette**: `#101010` background with `#CCCCCC` foreground.
- **Light Theme Palette**: `#F9F9F9` background with `#101010` foreground.
- **Zero-Flash Synchronous Mount**: Synchronous pre-mount theme injection into DOM attributes + live OS media query synchronization.
- **System Telemetry Panel**: Live diagnostics covering architecture, WSL distribution status, SQLite WAL health, and polling frequency options.

---

## 💻 System Requirements

- **Operating System**: Windows 10 (64-bit, Version 2004 / Build 19041 or higher) or Windows 11.
- **Runtime**: Microsoft Edge WebView2 (pre-installed on Windows 10/11).
- **Optional**: WSL 2 with at least one active Linux distribution for Linux microservice management.

---

## 🔮 Roadmap Beyond v0.1.0

The following features are planned for future major releases:
- Native system tray integration with quick-access status menu.
- Real-time socket event monitoring via ETW (Event Tracing for Windows).
- Live log streaming and terminal output viewer per server profile.
- Deep container inspection (Docker Desktop / Podman container integration).
- Custom environment variable management per project group.
- Native Linux host and macOS support.
