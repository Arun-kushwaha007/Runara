# DevHub Systems Architecture Document

```
Project:            DevHub — Local Development Control Center
Document Type:      System Architecture & Engineering Specification
Version:            1.0.0 (MVP Release)
Target Platform:    Windows 10 / 11 + WSL 2 (x86_64 / aarch64)
Author:             DevHub Engineering Team
```

---

## 1. Executive Summary & Problem Space

Modern software developers frequently manage multiple concurrent services during local development: React/Next.js frontend applications, Node/Python/Go/Rust backend APIs, asynchronous queue workers, background database helpers, and transient servers spawned by AI coding agents.

These servers are fragmented across:
1. Multiple terminal windows (PowerShell, Command Prompt, Windows Terminal, VS Code Integrated Terminals).
2. Heterogeneous operating environments (the native Windows host and various WSL Linux distributions).
3. Transient process states where port ownership is ambiguous (e.g. *"Which process is holding port 3000?"*).

**DevHub provides a native, low-overhead desktop control layer** that automatically discovers listening TCP endpoints, matches them to operating system process hierarchies, enriches them with runtime and project identity, safely manages process lifecycles without disturbing parent IDEs or shells, and orchestrates multi-service startup workflows.

---

## 2. High-Level System Architecture

DevHub follows a decoupled, secure desktop architecture powered by **Tauri 2 (Rust core backend)** and **React 19 + TypeScript (WebView UI)** communicating over asynchronous, strongly-typed JSON-RPC IPC channels.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             REACT 19 FRONTEND LAYER                              │
│                                                                                  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐  ┌────────────┐  │
│  │ Dashboard Page  │  │ Live Servers Tab │  │ Profiles Page   │  │ Projects   │  │
│  │ (Summary & Top) │  │ (Filter & Adopt) │  │ (CRUD & Launch) │  │ (Sequential│  │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬────────┘  │ Orchestrat)│  │
│           │                    │                     │           └─────┬──────┘  │
│           └────────────────────┼─────────────────────┴─────────────────┘         │
│                                │                                                 │
│                     ┌──────────▼───────────┐                                     │
│                     │ TypeScript API Client│ (commands.ts)                       │
│                     └──────────┬───────────┘                                     │
├────────────────────────────────┼─────────────────────────────────────────────────┤
│                                │ Tauri IPC Bridge (invoke / JSON-RPC)            │
├────────────────────────────────┼─────────────────────────────────────────────────┤
│                     ┌──────────▼───────────┐                                     │
│                     │ Tauri Command Router │ (src-tauri/src/commands/)           │
│                     └──────────┬───────────┘                                     │
│                                │                                                 │
│  ┌─────────────────────────────┼─────────────────────────────┐                   │
│  │ DOMAIN SERVICES LAYER       │                             │                   │
│  │ ┌────────────────────────┐  │ ┌────────────────────────┐  │                   │
│  │ │ UnifiedDiscoveryService│  │ │ ServerStartService     │  │                   │
│  │ └──────────┬─────────────┘  │ └──────────┬─────────────┘  │                   │
│  │ ┌──────────▼─────────────┐  │ ┌──────────▼─────────────┐  │                   │
│  │ │ ProcessIdentityService │  │ │ ProcessControlService  │  │                   │
│  │ └──────────┬─────────────┘  │ └──────────┬─────────────┘  │                   │
│  │ ┌──────────▼─────────────┐  │ ┌──────────▼─────────────┐  │                   │
│  │ │ ServerProfileService   │  │ │ ProjectOrchestrator    │  │                   │
│  │ └──────────┬─────────────┘  │ └──────────┬─────────────┘  │                   │
│  └────────────┼────────────────┼────────────┼────────────────┘                   │
│               │                │            │                                    │
│  ┌────────────▼─────────────┐  │ ┌──────────▼─────────────┐                      │
│  │ INFRASTRUCTURE ADAPTERS  │  │ │ PERSISTENCE (SQLite)   │                      │
│  │ ├── Win32 IP Helper FFI  │  │ │ ├── WAL Mode           │                      │
│  │ ├── Win32 Kernel32 FFI   │  │ │ ├── Foreign Keys       │                      │
│  │ ├── sysinfo & PEB Parser │  │ │ ├── Migration Runner   │                      │
│  │ └── WSL Subsystem Driver │  │ │ └── Repository Pattern │                      │
│  └──────────────────────────┘  │ └────────────────────────┘                      │
│                                │                                                 │
│                    NATIVE RUST BACKEND CORE                                      │
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
   │   (GetExtendedTcpTable)          │   WideChar UTF-16LE Decoder
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

Rather than relying solely on raw PIDs, DevHub constructs a 9-dimensional identity vector for each discovered process:

$$\text{Identity} = \langle \text{PID}, \text{PPID}, \text{Name}, \text{Image Path}, \text{Command Line}, \text{CWD}, \text{Runtime}, \text{Package Manager}, \text{Ancestry Tree} \rangle$$

- **Cycle Protection**: Guarded by `HashSet<u32>` and self-referencing parent checks.
- **Tree Depth Limits**: Maximum depth $D \le 32$ prevents stack overflow on malformed process tables.
- **Dynamic CWD Resolution**: Project folder name serves as the primary developer-friendly display name.

### 3.3 Safe Process Control & TOCTOU Mitigation

Terminating processes on an operating system without safety checks introduces Time-of-Check to Time-of-Use (TOCTOU) race conditions and PID reuse hazards.

DevHub enforces a strict **9-Point Pre-Termination Verification Gate**:
1. Target PID must be alive at the exact millisecond of termination.
2. Process name must match the expected image name.
3. Executable binary path on disk must match the inspected path.
4. Target working directory must match the recorded workspace.
5. System Critical Process Filter rejects termination of OS services (`svchost.exe`, `csrss.exe`, `explorer.exe`).
6. Ancestor Safety Invariant protects parent shells (`pwsh.exe`, `cmd.exe`, `bash`) and IDEs (`Code.exe`).
7. Subprocess tree discovery traverses via BFS to terminate leaf child workers first before terminating the parent.
8. Bounded exit wait loop (`WaitForSingleObject`) with 3000 ms timeout.
9. Post-termination TCP port verification verifies socket release.

### 3.4 Cross-Environment Launchers & Startup Orchestration

Server profiles define repeatable command executions:
- **Windows Launcher**: Dispatches `cmd.exe /D /C <command>` with `CREATE_NO_WINDOW` and explicit working directory.
- **WSL Launcher**: Dispatches `wsl.exe -d <distro> --cd <dir> -- sh -c <command>`.
- **Pre-Flight Port Conflict Check**: Verifies target port availability before launching. If occupied, aborts without killing and exposes the live occupant metadata in a conflict modal.
- **Readiness Polling Loop**: Polls TCP sockets every 500 ms up to a 20-second timeout bound to confirm listener readiness.

### 3.5 Sequential Project Orchestration

Multi-service development projects (e.g. Frontend + Backend API + Worker) require ordered startup:
1. **In-Flight Concurrency Locks**: `Arc<Mutex<HashMap<String, ProjectOperation>>>` prevents simultaneous duplicate operations on the same project.
2. **Fail-Fast Sequential Spawning**: Spawns service $i$, polls for TCP readiness, and only proceeds to service $i+1$ once service $i$ is verified healthy.
3. **No Destructive Auto-Rollback**: Leaves healthy services running upon failure so developers can fix the failing service and retry idempotently.
4. **8-Tier Dynamic Status Precedence**: Derives aggregate project state (`Running`, `Starting`, `Stopping`, `Stopped`, `Partial`, `Error`, `Empty`) purely from live process telemetry without stale database flags.

### 3.6 Persistence & Migration Engine

Local application state is stored in an embedded SQLite database:
- **Write-Ahead Logging (WAL Mode)**: Enables concurrent multi-reader access without lock contention.
- **Synchronous = NORMAL**: High performance with full crash durability.
- **Foreign Key Constraints & Cascading Deletes**: Clean deletion of project memberships.
- **Versioned Migration Runner**: Sequential migrations tracked in `schema_migrations`.

---

## 4. Security & Safety Boundaries

1. **WebView Isolation**: The frontend runs without Node.js integration; all system operations route through Tauri IPC.
2. **WSL Boundary**: In MVP, process termination of Linux processes inside WSL is restricted to read-only diagnostics to guarantee process safety.
3. **Safe Endpoint Resolution**: Local development endpoints normalize `0.0.0.0`, `127.0.0.1`, `[::]`, and `[::1]` to `localhost`, preventing invalid loopback browser launches.

---

## 5. Performance Metrics & Benchmarks

| Operation | Implementation | Typical Execution Time |
| :--- | :--- | :--- |
| Win32 Port Enumeration | `GetExtendedTcpTable` | $< 1.5\text{ ms}$ |
| Process Snapshot & PEB | `sysinfo` + Toolhelp32 | $8 - 15\text{ ms}$ |
| Multi-Environment Join | $O(P + S)$ Hash Map | $< 0.8\text{ ms}$ |
| Identity & Tree Build | $O(D)$ traversal | $< 0.4\text{ ms}$ |
| SQLite Profile Query | `rusqlite` WAL | $< 0.5\text{ ms}$ |
| UI Frame Rate | React 19 + Tailwind v4 | $60\text{ fps}$ (Idle CPU $< 0.1\%$) |
