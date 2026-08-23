# Runara Systems Architecture Specification

```
Product:            Runara — Local Development Control Center
Document Type:      Systems Architecture & Technical Design Document
Version:            0.1.0 (Public Release)
Target Platform:    Windows 10 / 11 + WSL 2 (x86_64 / aarch64)
Author:             Runara Engineering Team
```

---

## 1. Executive Summary & Problem Space

Modern software developers frequently manage multiple concurrent services during local development: React/Next.js frontend applications, Node/Python/Go/Rust backend APIs, asynchronous queue workers, background database helpers, and transient servers spawned by AI coding agents.

These servers are fragmented across:
1. Multiple terminal windows (PowerShell, Command Prompt, Windows Terminal, VS Code Integrated Terminals).
2. Heterogeneous operating environments (the native Windows host and various WSL Linux distributions).
3. Transient process states where port ownership is ambiguous (e.g. *"Which process is holding port 3000?"*).

**Runara provides a native, low-overhead desktop control layer** that automatically discovers listening TCP endpoints, matches them to operating system process hierarchies, enriches them with runtime and project identity, safely manages process lifecycles without disturbing parent IDEs or shells, and orchestrates multi-service startup workflows.

---

## 2. High-Level System Architecture

Runara follows a decoupled, secure desktop architecture powered by **Tauri 2 (Rust core backend)** and **React 19 + TypeScript (WebView UI)** communicating over asynchronous, type-safe JSON-RPC IPC channels:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            REACT 19 + TAILWIND V4 UI                             │
│  ┌───────────────┐  ┌──────────────┐  ┌───────────────┐  ┌────────────────────┐  │
│  │ Dashboard     │  │ Live Servers │  │ Profiles Page │  │ Project Groups     │  │
│  └───────┬───────┘  └──────┬───────┘  └───────┬───────┘  └────────┬───────────┘  │
│          └─────────────────┼──────────────────┴───────────────────┘              │
│                            ▼                                                     │
│                  TypeScript API Gateway (`src/lib/commands.ts`)                  │
├────────────────────────────────────┬─────────────────────────────────────────────┤
│                                    │ Tauri 2 IPC Channel (JSON-RPC)              │
├────────────────────────────────────▼─────────────────────────────────────────────┤
│                         Tauri Command Controllers                                │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │ DOMAIN SERVICES LAYER                                                      │  │
│  │ ├── UnifiedDiscoveryService ──► PortDiscovery + ProcessDiscovery           │  │
│  │ ├── ProcessIdentityService  ──► RuntimeDetector + ProcessTreeBuilder       │  │
│  │ ├── ProcessControlService   ──► Win32 Kernel Controller + WSL POSIX Signals│  │
│  │ ├── ServerProfileService    ──► SQLite Profile Repository                  │  │
│  │ ├── ServerStartService      ──► Windows/WSL Launchers + Readiness Polling  │  │
│  │ ├── ProjectOrchestrator     ──► Multi-Service Sequential Orchestrator      │  │
│  │ └── FilesystemService       ──► Native Folder Picker + WSL Guest Browser   │  │
│  └──────────────────────┬───────────────────────────────┬─────────────────────┘  │
│                         ▼                               ▼                        │
│          ┌─────────────────────────────┐  ┌───────────────────────────┐          │
│          │ INFRASTRUCTURE ADAPTERS     │  │ EMBEDDED SQLITE (WAL)     │          │
│          │ • Win32 IP Helper (FFI)     │  │ • Versioned Migrations    │          │
│          │ • Win32 Kernel32 (FFI)      │  │ • Foreign Key Cascades    │          │
│          │ • sysinfo & PEB Parser      │  │ • Gapless Profile Ordering│          │
│          │ • WSL 2 Subsystem Driver    │  │ • Zero Lock Contention    │          │
│          └─────────────────────────────┘  └───────────────────────────┘          │
│                                                                                  │
│                            NATIVE RUST BACKEND                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Subsystems & Components

### 3.1 Dual-Environment Discovery Pipeline

Discovery combines socket enumeration and process table snapshots across two isolated operating environments:

```
[Discovery Trigger] ──► UnifiedDiscoveryService
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [Windows Subsystem]                 [WSL 2 Subsystem]
            │                                 │
   ├── Win32 IP Helper                ├── Enumerate Distros (wsl -l -v)
   │   (GetExtendedTcpTable)          │   WideChar UTF-16LE / UTF-8 Decoder
   │   -> Active Listening Ports      │
   │                                  ├── Query Linux Ports (wsl -d <distro> ss -tlpn)
   ├── sysinfo Process Snapshot       │   -> Active Linux Sockets
   │   + PEB Command Line/CWD         │
   │                                  └── Query Linux Procs (wsl -d <distro> ps -eo)
   │                                      -> Linux Process Hierarchy
   └────────────────┬─────────────────┴────────────────┘
                    ▼
          [O(P + S) Map-Join]
          Key: (Environment, PID)
                    ▼
          [Process Identity Enricher]
          ├── Runtime Classification (Node, Python, Rust, .NET, Go, Java)
          ├── Package Manager Inference (npm, pnpm, yarn, bun, cargo)
          └── Ancestry Hierarchy Builder (O(D) traversal with cycle protection)
                    ▼
          [Profile Association Engine]
          ├── (Port + CWD) Deterministic Match -> Managed
          └── Ambiguous / Unknown -> Unmanaged
```

### 3.2 Process Identity Engine

Rather than relying solely on raw PIDs, Runara constructs a 9-dimensional identity vector for each discovered process:

$$\text{Identity} = \langle \text{PID}, \text{PPID}, \text{Name}, \text{Image Path}, \text{Command Line}, \text{CWD}, \text{Runtime}, \text{Package Manager}, \text{Ancestry Tree} \rangle$$

- **Cycle Protection**: Guarded by `HashSet<u32>` and self-referencing parent checks.
- **Tree Depth Limits**: Maximum depth $D \le 32$ prevents stack overflow on malformed process tables.
- **Dynamic CWD Resolution**: Project folder name serves as the primary developer-friendly display name.

### 3.3 Safe Process Control & TOCTOU Mitigation

Terminating processes on an operating system without safety checks introduces Time-of-Check to Time-of-Use (TOCTOU) race conditions and PID reuse hazards.

Runara enforces a strict **Multi-Environment Verification Gate**:
1. Target PID must be alive at the exact millisecond of termination.
2. Process name must match the expected image name.
3. Executable binary path on disk must match the inspected path.
4. Target working directory must match the recorded workspace.
5. System Critical Process Filter rejects termination of OS services (`svchost.exe`, `csrss.exe`, `explorer.exe`, Linux `init`/PID 1).
6. Ancestor Safety Invariant protects parent shells (`pwsh.exe`, `cmd.exe`, `bash`, `zsh`) and IDEs (`Code.exe`).
7. Subprocess tree discovery traverses via BFS to terminate leaf child workers first before terminating the parent.
8. Bounded exit wait loop (`WaitForSingleObject` on Windows / `kill -0` poll on Linux) with 3000 ms timeout.
9. Post-termination TCP port verification verifies socket release or detects rebound occupants (`PortOwnerChanged`).

### 3.4 POSIX Signal Control for WSL

For processes inside WSL 2 Linux distributions:
- **No Unescaped Shell Strings**: Runara passes structured argument vectors directly to `wsl.exe -d <distro> -- /bin/kill -<sig> <pid>`.
- **Graceful Termination**: Dispatches `SIGTERM` (15), polling with `kill -0` for process exit.
- **Forceful Termination**: Dispatches uncatchable `SIGKILL` (9) if graceful exit times out.
- **Cross-Environment Disambiguation**: Windows PIDs and WSL Linux guest PIDs are explicitly partitioned by environment metadata.

### 3.5 Filesystem Services & Directory Exploration

1. **Windows Directory Picker**: Invokes native Win32 folder selection dialog via `@tauri-apps/plugin-dialog`.
2. **WSL Guest Directory Browser**: Queries Linux guest directory listings via `wsl.exe -d <distro> -- find <path> -maxdepth 1` without recursion, parsing hidden folders and permissions safely.
3. **Path Validation Engine**: Verifies directory existence and permissions before persisting profiles.

### 3.6 Server Profiles & Startup Subsystem

Server profiles define repeatable command executions:
- **Windows Launcher**: Dispatches `cmd.exe /D /C <command>` with `CREATE_NO_WINDOW` and explicit working directory.
- **WSL Launcher**: Dispatches `wsl.exe -d <distro> --cd <dir> -- sh -c <command>`.
- **Pre-Flight Port Conflict Check**: Verifies target port availability before launching. If occupied, aborts without killing and exposes the live occupant metadata in a conflict modal.
- **Readiness Polling Loop**: Polls TCP sockets every 500 ms up to a 20-second timeout bound to confirm listener readiness.

### 3.7 Sequential Project Orchestration

Multi-service development projects (e.g. Frontend + Backend API + Worker) require ordered startup:
1. **In-Flight Concurrency Locks**: `Arc<Mutex<HashMap<String, ProjectOperation>>>` prevents simultaneous duplicate operations on the same project.
2. **Fail-Fast Sequential Spawning**: Spawns service $i$, polls for TCP readiness, and only proceeds to service $i+1$ once service $i$ is verified healthy.
3. **Safe Reverse-Order Teardown**: Gracefully shuts down services in reverse startup sequence ($N, N-1, \dots, 1$).
4. **No Destructive Auto-Rollback**: Leaves healthy services running upon failure so developers can fix the failing service and retry idempotently.
5. **8-Tier Dynamic Status Precedence**: Derives aggregate project state (`Running`, `Starting`, `Stopping`, `Stopped`, `Partial`, `Error`, `Empty`) purely from live process telemetry without stale database flags.

### 3.8 Persistence & Schema Migration Engine

Local application state is stored in an embedded SQLite database:
- **Write-Ahead Logging (WAL Mode)**: Enables concurrent multi-reader access without lock contention (`PRAGMA journal_mode = WAL`).
- **Synchronous = NORMAL**: High performance with full crash durability.
- **Foreign Key Constraints & Cascading Deletes**: Clean deletion of project memberships (`ON DELETE CASCADE`).
- **Versioned Migration Runner**: Sequential migrations tracked in `schema_migrations`.
- **Failure Recovery Screen**: Explicit UI with Retry and Exit actions if local storage initialization fails.

### 3.9 Dual-Theme Architecture & Semantic Design Tokens

- **Palette**: Dark Mode (`#101010` background, `#CCCCCC` foreground) and Light Mode (`#F9F9F9` background, `#101010` foreground).
- **CSS Custom Properties**: Tailwind CSS v4 variables (`--color-app-bg`, `--color-app-fg`, `--color-app-surface`, `--color-app-border`, `--color-app-card`).
- **Zero-Flash Synchronous Mount**: Synchronous pre-mount DOM attribute injection in `main.tsx` prevents visual theme flashing on startup.
- **Live OS Sync**: Listens to OS `prefers-color-scheme` changes via `window.matchMedia`.

---

## 4. Security & Safety Boundaries

1. **WebView Isolation**: The frontend runs without Node.js integration; all system operations route through Tauri IPC.
2. **IPC Input Validation**: All command parameters (PIDs, paths, commands, distro names) are validated before execution.
3. **Structured Argument Vectors**: Shell arguments avoid string concatenation to prevent command injection.
4. **Safe Endpoint Resolution**: Local development endpoints normalize `0.0.0.0`, `127.0.0.1`, `[::]`, and `[::1]` to `localhost`, preventing invalid loopback browser launches.
5. **Zero Bundled Secrets**: Production builds strip debug logging, sensitive environment variables, and credentials.

---

## 5. Platform Boundaries & Future Extension Strategy

### Current Supported Environments
- **Primary Host**: Windows 10 (64-bit, Version 2004 / Build 19041+) and Windows 11.
- **Supported Guest Subsystems**: WSL 2 Linux distributions (Ubuntu, Debian, Fedora, Arch).

### Unsupported Environments (Roadmap)
- Native Linux Host OS
- macOS Host OS
- Remote SSH Hosts
- Standalone Virtual Machines

### Architectural Extension Strategy
Runara isolates platform-specific code behind clean trait boundaries (`WslDistroDiscovery`, `WslProcessDiscovery`, `WslPortDiscovery`, `WslProcessController`, `FilesystemProvider`). Adding support for native Linux or macOS host environments in future releases will require adding new adapter implementations without altering core domain models (`ServerProfile`, `Project`, `ProcessIdentity`, `PortInfo`) or UI components.

---

## 6. Performance Benchmarks

| Operation | Implementation | Execution Time | Complexity |
| :--- | :--- | :--- | :--- |
| Win32 Port Enumeration | `GetExtendedTcpTable` (FFI) | $< 1.5\text{ ms}$ | $O(S)$ |
| Process Snapshot & PEB | `sysinfo` + Toolhelp32 | $8 - 15\text{ ms}$ | $O(P)$ |
| Multi-Environment Join | Hash Map Join | $< 0.8\text{ ms}$ | $O(P + S)$ |
| Identity & Tree Build | $O(D)$ traversal ($D \le 32$) | $< 0.4\text{ ms}$ | $O(P)$ |
| SQLite WAL Profile Query | `rusqlite` WAL | $< 0.5\text{ ms}$ | $O(1)$ indexed |
| UI Frame Rate | React 19 + Tailwind v4 | $60\text{ fps}$ | Idle CPU $< 0.1\%$ |
