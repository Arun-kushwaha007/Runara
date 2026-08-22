# DevHub

> **Local Development Control Center**

DevHub is a native Windows desktop application for managing local development servers across Windows and WSL from a single centralized interface.

---

## 🚀 Overview

Developers frequently run multiple frontend applications, backend APIs, background workers, and AI-agent created development servers simultaneously across Windows and WSL. 

**The core problem is visibility and control:**
- Identifying which process or project owns a specific port (e.g. port 3000)
- Tracking servers split across Windows terminals and WSL distributions
- Safely stopping, restarting, and organizing local development services

DevHub provides a unified control layer over local development processes without requiring manual terminal searches or PID lookups.

---

## 📚 Documentation & Engineering Guides

- **[Product Requirements Document (PRD.md)](doc/PRD.md)** — Complete product specifications, domain models, and milestone roadmap.
- **[Engineering Learning Guide (LEARNING.md)](LEARNING.md)** — Comprehensive educational guide covering CS fundamentals, Windows systems programming, networking theory, HLD/LLD architecture, cross-language IPC, and code traces for interview preparation.

---

## 🛠️ Technology Stack

- **Desktop Framework:** [Tauri 2](https://v2.tauri.app/)
- **Native Backend:** [Rust](https://www.rust-lang.org/)
- **Frontend Framework:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler:** [Vite](https://vite.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Testing:** [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) (Frontend) & `cargo test` (Rust Backend)

---

## 📍 Current Status

- **Milestone 0: Project Foundation (Complete)**
  - Initial desktop application shell and navigation structure
  - React + TypeScript + Vite + Tailwind CSS frontend pipeline
  - Tauri 2 + Rust native backend configuration
  - Verified React ↔ Tauri/Rust IPC communication
  - Windows desktop executable build verified

- **Milestone 1: Windows Process Discovery (Complete)**
  - Native Rust process discovery service (`sysinfo`)
  - Normalized `ProcessInfo` model (PID, PPID, name, executable path, command line, CWD, status)
  - Tauri IPC `get_processes` command with Serde camelCase mapping
  - Interactive process inspection dashboard with search, sorting, auto-refresh polling, and process details modal
  - Comprehensive unit and integration test coverage

- **Milestone 2: Windows Port Discovery (Complete)**
  - Native Win32 IP Helper API integration (`iphlpapi.dll` & `GetExtendedTcpTable`) for sub-millisecond listening TCP socket discovery
  - Complete support for IPv4 (`AF_INET`, `127.0.0.1`, `0.0.0.0`) and IPv6 (`AF_INET6`, `[::1]`, `[::]`) endpoints with network byte-order translation
  - Normalized `PortInfo` domain model and decoupled `PortDiscovery` service trait
  - High-performance $O(P + S)$ Hash Map join associating listening ports with owning `ProcessInfo` metadata
  - Support for multi-port processes, wildcard addresses, and missing process degradation
  - Dedicated Listening Ports & Processes interactive table with searching, column sorting, clipboard copying, and auto-refresh (3s)
  - Deep networking fundamentals and systems architecture chapters added to `LEARNING.md`

- **Milestone 3: Process Identity (Complete)**
  - Rich `ProcessIdentity` domain entity composing process metadata, runtime, package manager, parent info, ancestry tree, and listening ports
  - Conservative software runtime classification (`Node.js`, `Python`, `Java`, `.NET`, `Go`, `Rust`, `Unknown`) via `RuntimeDetector`
  - Dual-source package manager detection (`npm`, `pnpm`, `yarn`, `bun`, `Unknown`) via command-line parsing and ancestry inspection
  - Reconstructed process ancestry tree (`ProcessTreeBuilder`) with $O(P)$ hash map indexing, $O(D)$ traversal, `HashSet<u32>` cycle protection, self-parent protection, and depth limits ($D \le 32$)
  - Multi-port association allowing a single process to own multiple distinct listening sockets
  - Interactive Process Ancestry Tree visualization in the Process Details Panel with current process highlighting
  - Enriched process table with runtime badges, package manager tags, port chips, and deep search across all identity dimensions
  - Comprehensive educational guide chapters 28–39 added to `LEARNING.md` covering process identity, ancestry algorithms, and systems interview preparation

- **Milestone 4: Server Dashboard (Complete)**
  - Developer-oriented `DashboardServer` view model and multi-port process aggregation
  - Conservative server name inference (workspace directory folder name → runtime fallback → process name)
  - Summary metrics cards (Running Servers, Listening Ports, Windows Processes, WSL status)
  - Instant client-side search-as-you-type across name, port, PID, runtime, package manager, command, and CWD
  - Dynamic runtime filtering, environment selectors, and multi-field stable sorting (Port, PID, Name, Runtime)
  - 3-tier progressive disclosure: developer server cards + deep server inspection modal
  - Embedded process ancestry lineage visualizer with target process highlighting
  - One-click clipboard copy triggers for PIDs, ports, paths, and commands with visual feedback
  - Safe browser launching for localhost development endpoints
  - Auto-refresh polling (3s) with clean lifecycle unmount handling
  - Chapters 40–49 added to `LEARNING.md` covering View Models, Derived State, UI Data Pipelines, UX State Machines, and HLD/LLD Interview Q&A

- **Milestone 5: Safe Windows Process Control (Complete)**
  - Native Win32 `kernel32.dll` direct FFI bindings (`OpenProcess`, `TerminateProcess`, `WaitForSingleObject`, `CloseHandle`)
  - Memory-safe RAII `ProcessHandle` wrapper guaranteeing deterministic handle reclamation
  - 9-point pre-termination identity verification (PID existence, process name match, executable path equality, CWD verification, system process protection)
  - BFS descendant tree discovery terminating leaf worker processes before the root server process
  - Strict Ancestor Safety Rule preventing accidental termination of IDEs (`Code.exe`), shells (`pwsh.exe`, `cmd.exe`), or parent wrappers
  - Bounded post-termination exit polling loop (3000 ms) via `WaitForSingleObject`
  - Post-termination TCP port verification diagnosing freed ports vs. port ownership changes
  - Modal-based stop confirmation with target metadata disclosure and pre-termination safety notice
  - Per-server non-blocking stopping state machine (`stoppingPids: Set<number>`) with animated indicators
  - Full suite of 45 Rust unit/integration tests and 21 React frontend tests passing
  - Chapters 50–61 added to `LEARNING.md` covering OS process control, PID reuse, TOCTOU mitigation, and HLD/LLD interview preparation

- **Milestone 6: WSL Integration (Complete)**
  - Dual-environment architecture modeling Windows host and WSL Linux distributions as distinct infrastructure sources feeding a normalized domain model
  - Multi-environment `Environment` enum (`Environment::Windows` & `Environment::Wsl { distro }`) and composite `(Environment, PID)` keys preventing cross-environment process or port collisions
  - Robust WSL distribution discovery (`wsl.exe -l -v`) with UTF-16LE / wide-character byte decoding and state filtering (only inspecting active `Running` distributions)
  - Linux process discovery (`ps -eo pid,ppid,comm,args --no-headers`) and socket statistics discovery (`ss -tlpn -H`) executing with direct argument vectors and a strict 3000 ms timeout bound
  - Environment-isolated process tree reconstruction and runtime detection (`Node.js`, `Python`, `Rust`, `npm`, `pnpm`, `yarn`, `bun`, `cargo`)
  - Unified multi-environment discovery service (`UnifiedDiscoveryService`) with graceful degradation and partial failure isolation (`DiscoveryDiagnostic`)
  - Strict read-only safety boundary for WSL processes preserving Milestone 5 Windows process control guarantees
  - Unified Dashboard UI with environment badge chips, WSL distro filters, WSL distribution summary metrics, and diagnostic warning notices
  - 68 Rust unit/integration tests and 25 React frontend tests passing (100% test pass rate)
- **Milestone 7: Server Profiles & Launch Management (Complete)**
  - Embedded SQLite database engine (`rusqlite`) configured with Write-Ahead Logging (WAL Mode), foreign keys, and synchronous normal durability
  - Forward-only database migration runner (`MigrationRunner`) with versioned schema tracking (`schema_migrations`)
  - Normalized `ServerProfile` domain model with UUID v4 persistent identifiers and UTC timestamps
  - `ServerProfileRepository` trait abstraction with complete SQLite CRUD implementation
  - Cross-environment process launcher subsystem (`EnvironmentLauncher`):
    - `WindowsLauncher` executing `cmd.exe /D /C` with `CREATE_NO_WINDOW`
    - `WslLauncher` executing `wsl.exe -d <distro> --cd <dir> -- sh -c` with `CREATE_NO_WINDOW`
  - Robust startup orchestration engine (`ServerStartService`):
    - Non-destructive pre-flight port conflict checking refusing launch if expected port is already occupied
    - Asynchronous subprocess spawning and non-blocking in-flight tracking
    - Bounded 20-second readiness polling loop (500 ms intervals) with early process crash detection
    - Safe Windows server restart flow (Stop &rarr; Bounded Wait &rarr; Port Release Verification &rarr; Fresh Launch)
  - `ServerProfileService` domain service with multi-signal process association (Port + CWD matching) yielding enriched `ServerProfileView` models
  - Dedicated **Servers & Profiles** page (`Servers.tsx`) featuring:
    - View Switcher Tabs ("Server Profiles" and "Live Discovered Servers")
    - Profile Cards with environment badges, copyable commands, runtime status indicators, and action triggers
    - Full modal suite: Create/Edit Profile Modal, Delete Profile Modal (with non-destruction notice), and Port Conflict Modal (with live owner inspection)
    - Safe WSL process control boundary enforcement (read-only action guards)
  - Full suite of 87 Rust unit/integration tests and 32 React frontend tests passing (100% test pass rate)
  - Chapters 74–84 added to `LEARNING.md` covering persistence architecture, WAL mode, process launching, startup polling, and systems interview preparation

*Next Milestone: Milestone 8 — Project Workspaces & Multi-Server Groups*

---

## 💻 Local Development Setup

### Prerequisites

1. **Node.js** (v18+ recommended, LTS) & **npm**
2. **Rust & Cargo** (1.78+ recommended, MSVC toolchain on Windows)
   ```powershell
   # Install Rust via rustup if needed
   winget install Rustlang.Rustup
   ```
3. **Microsoft C++ Build Tools** & **WebView2** (included with modern Windows 10/11)
4. **WSL 2** (optional, for inspecting Linux development servers)

### Installation

```bash
# Clone the repository
git clone https://github.com/Arun-kushwaha007/DevHub.git
cd DevHub

# Install frontend dependencies
npm install
```

### Running the App

```bash
# Run the Tauri desktop app in development mode (with Hot Module Replacement)
npm run tauri dev

# Run only the Vite frontend dev server in browser
npm run dev
```

### Running Tests

```bash
# Run Rust backend unit and integration tests (87 tests)
cd src-tauri
cargo test

# Run frontend unit and component tests (32 tests)
npm test -- --run

# Run frontend build and typecheck
npm run build
```

### Building for Production

```bash
# Build frontend and compile the Windows desktop executable
npm run tauri build
```

---

## 📁 Project Architecture

```
DevHub/
├── src/                      # React Frontend
│   ├── components/           # Reusable UI components
│   │   ├── common/           # CopyButton, EmptyState, LoadingState, ErrorState
│   │   ├── dashboard/        # ServerCard, ServerList, ServerToolbar, SummaryCards, 
│   │   │                     # ServerDetailsModal, StopConfirmationModal, ProcessTree
│   │   ├── profiles/         # ProfileCard, ProfileFormModal, DeleteProfileModal, PortConflictModal
│   │   ├── ports/            # PortTable, PortDetailsModal
│   │   ├── processes/        # ProcessTable, ProcessDetailsModal
│   │   ├── Sidebar.tsx       # Navigation sidebar
│   │   ├── Header.tsx        # Top header
│   │   └── Layout.tsx        # App layout shell
│   ├── pages/                # Application views (Dashboard, Servers, Projects, Settings)
│   ├── types/                # TypeScript interfaces (control.ts, environment.ts, identity.ts, port.ts, process.ts, profile.ts, server.ts)
│   ├── lib/                  # Commands API client (commands.ts) & View Pipeline (serverUtils.ts)
│   ├── App.tsx               # Main application component
│   ├── main.tsx              # React DOM entry point
│   └── index.css             # Tailwind CSS entry & dark theme styles
├── src-tauri/                # Rust Native Backend
│   ├── src/
│   │   ├── commands/         # Tauri IPC commands (control.rs, identity.rs, ports.rs, processes.rs, profiles.rs, system.rs, wsl.rs)
│   │   ├── db/               # Persistence layer (mod.rs, migration.rs, repository.rs)
│   │   ├── discovery/        # Discovery services (port.rs, process.rs, unified.rs)
│   │   ├── identity/         # Process identity engine (detector.rs, service.rs, tree.rs)
│   │   ├── launcher/         # Cross-environment process launchers (mod.rs, windows.rs, wsl.rs)
│   │   ├── models/           # Domain models (control.rs, environment.rs, identity.rs, port.rs, process.rs, profile.rs)
│   │   ├── process/          # Process control domain service (service.rs)
│   │   ├── profile/          # Profile domain services (mod.rs, service.rs, start_service.rs)
│   │   ├── windows/          # Windows Win32 FFI (networking.rs, process.rs)
│   │   ├── wsl/              # WSL infrastructure (distro.rs, executor.rs, port.rs, process.rs)
│   │   ├── lib.rs            # Tauri application entry point & handler registry
│   │   └── main.rs           # Desktop binary entry
│   ├── Cargo.toml            # Rust dependencies and package configuration
│   └── tauri.conf.json       # Tauri window and build configuration
├── doc/
│   └── PRD.md                # Product Requirements Document
├── LEARNING.md               # Engineering Learning & Code-Reading Guide
└── README.md                 # Project Overview & Setup Instructions
```

---

## 📄 License

Private / Proprietary.


