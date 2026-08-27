# Runara

> **Local Development Control Center for Windows and WSL**

[![Tauri 2](https://img.shields.io/badge/Tauri-2.0-24C8D5?logo=tauri&logoColor=white)](https://v2.tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-1.78+-orange?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4.3-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Tests](https://img.shields.io/badge/Tests-294%20Passed-brightgreen)](RELEASE_CHECKLIST.md)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

Runara is a high-performance, native Windows desktop application that gives developers a centralized control layer for discovering, identifying, starting, stopping, restarting, and organizing local development servers across native Windows and WSL 2 Linux distributions.

---

## ⚡ The Problem

Modern developers frequently run 5 to 15 concurrent local services: Next.js frontend apps, FastAPI/Express microservices, Redis/DB helpers, background workers, and ephemeral servers spawned by AI coding agents.

This leads to constant friction:
* *"Which process is holding port 3000?"*
* *"Where is the terminal that started this background API?"*
* *"How do I safely restart a service without accidentally killing my VS Code window or PowerShell shell?"*
* *"Why are my Linux microservices in WSL isolated from my Windows desktop tooling?"*
* *"Why did my project service fail to start, and where are its startup error logs?"*

**Runara solves local environment visibility and control** by providing a native control center above operating system processes.

---

## ✨ Key Features

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                               RUNARA CAPABILITIES                                 │
├─────────────────────┬──────────────────────┬──────────────────────────────────────┤
│ 🔍 Discovery        │ 🛡️ Safe Control      │ 🚀 Orchestration & Observability     │
│ • Win32 IP Helper   │ • 7-Signal Pre-Term  │ • Persistent Server Profiles (SQLite)│
│ • Sub-ms TCP Scan   │   Verification Gate  │ • Multi-Service Projects Engine      │
│ • WSL 2 Multi-Distro│ • Ancestor Guardrail │ • Desired-State Sequential Startup   │
│ • O(P+S) Map Join   │ • Leaf Worker BFS    │ • Safe Reverse-Order Teardown        │
│ • 9D Process Ident  │ • Windows & WSL POSIX│ • In-Memory Concurrency Guards (RAII)│
│ • Tree Cycles (≤32) │ • Direct Arg Vectors │ • Live Project Service Log Preview   │
│ • Zero Native Leaks │ • Safe Port Conflict │ • Bounded Ring Buffer (5,000 lines)  │
│                     │                      │ • ANSI Stripping & Stream Filters    │
└─────────────────────┴──────────────────────┴──────────────────────────────────────┘
```

* **Sub-Millisecond Socket Discovery**: Queries the native Win32 IP Helper API (`GetExtendedTcpTable`) directly in kernel memory for instant listening socket enumeration across IPv4, IPv6, and wildcard addresses.
* **Dual-Environment Architecture**: Seamlessly discovers and aggregates development processes running on the Windows host and inside active WSL 2 Linux distributions (Ubuntu, Debian, Fedora, Arch).
* **9-Dimensional Process Identity**: Classifies runtimes (`Node.js`, `Python`, `Rust`, `.NET`, `Go`, `Java`) and package managers (`npm`, `pnpm`, `yarn`, `bun`, `cargo`), resolving human-friendly workspace folder names.
* **Process Ancestry Tree Visualization**: Reconstructs hierarchical process lineages with cycle protection ($D \le 32$) to disambiguate child servers from parent wrappers.
* **Safe Win32 & WSL Linux Process Control**: Eliminates PID reuse and TOCTOU vulnerabilities with a multi-environment validation gate. Ancestor protection guarantees shells (`pwsh.exe`, `cmd.exe`, `bash`, `zsh`) and IDEs (`Code.exe`, IDE server) are never terminated. Supports graceful `SIGTERM` and forceful `SIGKILL` on Linux.
* **Native Windows & WSL Folder Browsing**: Environment-aware directory selection replacing manual path typing. Features native Win32 folder chooser dialog for Windows profiles and a live, interactive Linux guest directory browser for WSL distributions.
* **Persistent Server Profiles**: SQLite-backed (WAL mode) repeatable launch configurations with one-click cross-environment execution, non-blocking readiness polling, and live restart.
* **Unknown Server Adoption**: Automatically detects unmanaged background servers and synthesizes transient adoption drafts for instant profile enrollment with visual path adjustment.
* **Multi-Service Projects & Complete Orchestration**: Groups related microservices into logical projects with declarative desired-state sequential startup (skips already-healthy services), safe reverse-order teardown, atomic SQLite gapless ordering, transient in-memory operation locks with RAII cleanup, and full confirmation modals with sequence breakdowns.
* **Live Project Service Log Previews**: Embedded transient log previews within project services with real-time streaming, bounded 5,000-line ring buffers, ANSI escape code stripping, pause/resume auto-scroll, stream filters (`stdout` vs `stderr`), instant text search, clipboard copying, and honest diagnostic indicators for externally started processes.
* **Full Dual-Theme Architecture & Semantic Design Tokens**: Instant switching between high-contrast Dark Mode (`#101010` background, `#CCCCCC` foreground), Light Mode (`#F9F9F9` background, `#101010` foreground), and dynamic System Sync via Tailwind v4 CSS variables. Features flash-free synchronous pre-mount initialization, live OS media query updates, and a dedicated Appearance & Settings page with token previews.
* **Polished Desktop UX**: Dark-theme design tokens, progressive disclosure inspection modals, single-click clipboard copy triggers, global keyboard shortcuts (`Ctrl+1..5`, `Ctrl+R`, `Esc`), and live system telemetry.

---

## 🏛️ System Architecture

Runara decouples a **native Rust backend core** from a **React 19 + TypeScript WebView** connected via asynchronous, type-safe JSON-RPC IPC:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            REACT 19 + TAILWIND V4 UI                             │
│  ┌───────────────┐  ┌──────────────┐  ┌───────────────┐  ┌────────────────────┐  │
│  │ Dashboard     │  │ Live Servers │  │ Profiles Page │  │ Project Groups     │  │
│  └───────┬───────┘  └──────┬───────┘  └───────┬───────┘  └────────┬───────────┘  │
│          │                 │                  │                   │              │
│          └─────────────────┴──────────────────┴───────────────────┘              │
│                                    ▼                                             │
│                  TypeScript API Gateway (`src/lib/commands.ts`)                  │
├────────────────────────────────────┬─────────────────────────────────────────────┤
│                                    │ Tauri 2 IPC Channel & Live Event Bus        │
├────────────────────────────────────▼─────────────────────────────────────────────┤
│                         Tauri Command Controllers                                │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │ DOMAIN SERVICES LAYER                                                      │  │
│  │ ├── UnifiedDiscoveryService ──► PortDiscovery + ProcessDiscovery           │  │
│  │ ├── ProcessIdentityService  ──► RuntimeDetector + ProcessTreeBuilder       │  │
│  │ ├── ProcessControlService   ──► Win32 Kernel Controller + Safety Gates     │  │
│  │ ├── ServerProfileService    ──► SQLite Profile Repository                  │  │
│  │ ├── ServerStartService      ──► Windows/WSL Launchers + Readiness Polling  │  │
│  │ ├── ProjectOrchestrator     ──► Multi-Service Sequential Orchestrator      │  │
│  │ └── LogManager              ──► Bounded Ring Buffer + ANSI + Live Emitter  │  │
│  └──────────────────────┬───────────────────────────────┬─────────────────────┘  │
│                         ▼                               ▼                        │
│          ┌─────────────────────────────┐  ┌───────────────────────────┐          │
│          │ INFRASTRUCTURE ADAPTERS     │  │ EMBEDDED SQLITE (WAL)     │          │
│          │ • Win32 IP Helper (FFI)     │  │ • Versioned Migrations    │          │
│          │ • Win32 Kernel32 (FFI)      │  │ • Foreign Key Cascades    │          │
│          │ • sysinfo & PEB Parser      │  │ • Gapless Profile Ordering│          │
│          │ • WSL 2 Subsystem Driver    │  │ • Zero Lock Contention    │          │
│          │ • Piped Stdio Worker Threads│  │                           │          │
│          └─────────────────────────────┘  └───────────────────────────┘          │
│                                                                                  │
│                            NATIVE RUST BACKEND                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

For complete technical specifications, see **[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Desktop Shell** | [Tauri 2](https://v2.tauri.app/) (Rust-based native window and IPC runtime) |
| **Backend Core** | [Rust 2021](https://www.rust-lang.org/) (`windows-sys`, `sysinfo`, `rusqlite`, `serde`, `uuid`, `chrono`) |
| **Persistence** | Embedded [SQLite 3](https://www.sqlite.org/) with Write-Ahead Logging (WAL) |
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript 5.8](https://www.typescriptlang.org/) |
| **Bundler & Tooling** | [Vite 7](https://vite.dev/) |
| **Styling & UI Tokens** | [Tailwind CSS v4](https://tailwindcss.com/) (Semantic Tokens, Dark & Light Modes) |
| **Automated Testing** | [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) (147 tests) & `cargo test` (133 tests) |

---

## 🚀 Installation & Distribution

### Option 1: Windows Installers (Recommended)

Download the latest release from [GitHub Releases](https://github.com/Arun-kushwaha007/DevHub/releases):

* **Standard Setup Installer (NSIS)**: `Runara_0.1.0_x64-setup.exe` (Self-contained installer with desktop shortcut and Start Menu entry).
* **Enterprise MSI Package**: `Runara_0.1.0_x64_en-US.msi` (Standard Windows Installer package for managed deployments).
* **Standalone Portable Binary**: `Runara.exe` (Run directly without installation).

### Option 2: Build from Source

#### Prerequisites
1. **Node.js** (v18+ LTS) & **npm**
2. **Rust & Cargo** (1.78+ with MSVC toolchain on Windows):
   ```powershell
   winget install Rustlang.Rustup
   ```
3. **Microsoft C++ Build Tools** & **WebView2** (included with Windows 10/11)
4. **WSL 2** *(Optional)*: If you wish to manage Linux development servers.

#### Build & Run
```bash
# Clone the repository
git clone https://github.com/Arun-kushwaha007/DevHub.git
cd DevHub

# Install frontend dependencies
npm install

# Run in development mode with Hot Module Replacement (HMR)
npm run tauri dev

# Package production release binaries and installers
npx tauri build
```

---

## 🧪 Testing & Verification

Runara enforces a strict test-driven quality standard with **280 automated tests**:

```bash
# Run Rust backend unit & integration tests (133 tests)
cd src-tauri
cargo test

# Run frontend unit & component tests (147 tests across 17 suites)
npm test

# Run strict TypeScript typecheck and production frontend bundle
npm run build
```

---

## 📁 Repository Structure

```
DevHub/
├── src/                          # React 19 Frontend
│   ├── components/               # UI Design System & Modals
│   │   ├── adoption/             # AdoptionFormModal, DuplicateProfileWarning
│   │   ├── common/               # Toast, CopyButton, WorkingDirectoryField, WslDirectoryBrowserModal
│   │   ├── dashboard/            # ServerCard, ServerList, ServerToolbar, SummaryCards, 
│   │   │                         # ServerDetailsModal, StopConfirmationModal, ProcessTree
│   │   ├── profiles/             # ProfileCard, ProfileFormModal, DeleteProfileModal, PortConflictModal
│   │   ├── projects/             # ProjectCard, ProjectDetailsModal, ProjectFormModal, 
│   │   │                         # AddProfileModal, DeleteProjectModal, RemoveProfileModal,
│   │   │                         # ProjectStopConfirmationModal, ProjectRestartConfirmationModal, ProgressModal
│   │   ├── ports/                # PortTable, PortDetailsModal
│   │   ├── processes/            # ProcessTable, ProcessDetailsModal
│   │   ├── Sidebar.tsx           # 5-Route navigation sidebar with shortcut hints
│   │   ├── Header.tsx            # Top header with breadcrumbs and live status
│   │   └── Layout.tsx            # App shell with global keyboard shortcuts
│   ├── pages/                    # Main views (Dashboard, Servers, Profiles, Projects, Settings)
│   ├── context/                  # ThemeContext provider and hooks
│   ├── types/                    # Strongly-typed cross-language TypeScript contracts
│   ├── lib/                      # API client (commands.ts), Pipeline (serverUtils.ts), Adoption (profileAssociation.ts), Theme (theme.ts)
│   ├── App.tsx                   # App root with initialization health check and recovery screens
│   └── index.css                 # Tailwind CSS v4 styling & dark/light theme tokens
├── src-tauri/                    # Rust Native Backend Core
│   ├── src/
│   │   ├── commands/             # Tauri IPC controllers (system, control, profiles, project, wsl, ports, processes, filesystem)
│   │   ├── db/                   # SQLite persistence, schema migrations, and repository pattern
│   │   ├── discovery/            # Win32 IP Helper, Toolhelp snapshot, and unified discovery
│   │   ├── filesystem/           # Win32 & WSL filesystem exploration and validation providers
│   │   ├── identity/             # Process identity engine, runtime classifier, ancestry tree builder
│   │   ├── launcher/             # Cross-environment process launchers (Windows cmd.exe / WSL sh)
│   │   ├── models/               # Strongly-typed domain models with Serde camelCase mapping
│   │   ├── process/              # Safe Win32 kernel process control domain service
│   │   ├── profile/              # Profile validation, adoption heuristics, and startup service
│   │   ├── project/              # Project service and sequential orchestration engine
│   │   ├── windows/              # Native Win32 FFI bindings (networking.rs, process.rs)
│   │   ├── wsl/                  # WSL subsystem adapter (distro.rs, executor.rs, port.rs, process.rs, control.rs)
│   │   ├── lib.rs                # Tauri handler registry & dependency injection
│   │   └── main.rs               # Desktop executable entry point
│   ├── Cargo.toml                # Rust dependencies and package configuration
│   └── tauri.conf.json           # Window dimensions, icon assets, and build bundler targets
├── doc/
│   └── PRD.md                    # Product Requirements Document
├── ARCHITECTURE.md               # Systems Architecture Specification
├── LEARNING.md                   # Cumulative Engineering Learning Guide (160+ Chapters)
├── RELEASE_CHECKLIST.md          # MVP Release Verification Matrix
├── RELEASE_NOTES.md              # Version 0.1.0 Release Notes
└── README.md                     # Project Presentation & Documentation
```

---

## 📚 Engineering Documentation

* **[ARCHITECTURE.md](ARCHITECTURE.md)** — In-depth architectural blueprint covering domain invariants, Win32 FFI, POSIX signals, TOCTOU safety, sequential orchestration, and concurrency locks.
* **[LEARNING.md](LEARNING.md)** — 160+ chapter comprehensive engineering learning guide covering OS internals, networking theory, system design, HLD/LLD interview preparation, and code traces.
* **[PRD.md](doc/PRD.md)** — Complete Product Requirements Document.
* **[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)** — MVP verification matrix.
* **[RELEASE_NOTES.md](RELEASE_NOTES.md)** — Release notes, SHA-256 checksums, and changelog.
* **[CONTRIBUTING.md](CONTRIBUTING.md)** — Contribution guidelines, architecture overviews, and local development setup.

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for full development setup instructions, architecture overviews, and contribution guidelines.

---

## 📄 License

Runara is released under the [MIT License](LICENSE).
