# DevHub

> **Local Development Control Center for Windows and WSL**

[![Tauri 2](https://img.shields.io/badge/Tauri-2.0-24C8D5?logo=tauri&logoColor=white)](https://v2.tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-1.78+-orange?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4.3-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Tests](https://img.shields.io/badge/Tests-222%20Passed-brightgreen)](file:///d:/ak/project/devhub/DevHub/RELEASE_CHECKLIST.md)
[![License](https://img.shields.io/badge/License-MIT%20%2F%20Apache--2.0-blue)](LICENSE)

DevHub is a high-performance, native Windows desktop application that gives developers a centralized control layer for discovering, identifying, starting, stopping, restarting, and organizing local development servers across native Windows and WSL 2 Linux distributions.

---

## ⚡ The Problem

Modern developers frequently run 5 to 15 concurrent local services: Next.js frontend apps, FastAPI/Express microservices, Redis/DB helpers, background workers, and ephemeral servers spawned by AI coding agents.

This leads to constant friction:
* *"Which process is holding port 3000?"*
* *"Where is the terminal that started this background API?"*
* *"How do I safely restart a service without accidentally killing my VS Code window or PowerShell shell?"*
* *"Why are my Linux microservices in WSL isolated from my Windows desktop tooling?"*

**DevHub solves local environment visibility and control** by providing a native control center above operating system processes.

---

## ✨ Key Features

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                               DEVHUB CAPABILITIES                                 │
├─────────────────────┬──────────────────────┬──────────────────────────────────────┤
│ 🔍 Discovery        │ 🛡️ Safe Control      │ 🚀 Orchestration                     │
│ • Win32 IP Helper   │ • 7-Signal Pre-Term  │ • Persistent Server Profiles (SQLite)│
│ • Sub-ms TCP Scan   │   Verification Gate  │ • Sequential Fail-Fast Startup       │
│ • WSL 2 Multi-Distro│ • Ancestor Guardrail │ • Pre-Flight Port Conflict Resolv    │
│ • O(P+S) Map Join   │ • Leaf Worker BFS    │ • Cross-Environment Restarts         │
│ • 9D Process Ident  │ • Windows & WSL POSIX│ • Dynamic 8-Tier State Machine       │
│ • Tree Cycles (≤32) │ • Direct Arg Vectors │ • Unknown Server Adoption Heuristics │
└─────────────────────┴──────────────────────┴──────────────────────────────────────┘
```

* **Sub-Millisecond Socket Discovery**: Queries the native Win32 IP Helper API (`GetExtendedTcpTable`) directly in kernel memory for instant listening socket enumeration across IPv4, IPv6, and wildcard addresses.
* **Dual-Environment Architecture**: Seamlessly discovers and aggregates development processes running on the Windows host and inside active WSL 2 Linux distributions (Ubuntu, Debian, Fedora, Arch).
* **9-Dimensional Process Identity**: Classifies runtimes (`Node.js`, `Python`, `Rust`, `.NET`, `Go`, `Java`) and package managers (`npm`, `pnpm`, `yarn`, `bun`, `cargo`), resolving human-friendly workspace folder names.
* **Process Ancestry Tree Visualization**: Reconstructs hierarchical process lineages with cycle protection ($D \le 32$) to disambiguate child servers from parent wrappers.
* **Safe Win32 & WSL Linux Process Control**: Eliminates PID reuse and TOCTOU vulnerabilities with a multi-environment validation gate. Ancestor protection guarantees shells (`pwsh.exe`, `cmd.exe`, `bash`) and IDEs (`Code.exe`, IDE server) are never terminated. Supports graceful `SIGTERM` and forceful `SIGKILL` on Linux.
* **Native Windows & WSL Folder Browsing**: Environment-aware directory selection replacing manual path typing. Features native Win32 folder chooser dialog for Windows profiles and a live, interactive Linux guest directory browser for WSL distributions.
* **Persistent Server Profiles**: SQLite-backed (WAL mode) repeatable launch configurations with one-click cross-environment execution, non-blocking readiness polling, and live restart.
* **Unknown Server Adoption**: Automatically detects unmanaged background servers and synthesizes transient adoption drafts for instant profile enrollment with visual path adjustment.
* **Project Groups & Sequential Orchestration**: Groups related microservices into logical projects with deterministic sequential startup, reverse-order teardown, concurrency locks, and aggregate health derivation across Windows and WSL.
* **Polished Desktop UX**: Dark-theme design tokens, progressive disclosure inspection modals, single-click clipboard copy triggers, global keyboard shortcuts (`Ctrl+1..5`, `Ctrl+R`, `Esc`), and live system telemetry.

---

## 🏛️ System Architecture

DevHub decouples a **native Rust backend core** from a **React 19 + TypeScript WebView** connected via asynchronous, type-safe JSON-RPC IPC:

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
│                                    │ Tauri 2 IPC Channel                         │
├────────────────────────────────────▼─────────────────────────────────────────────┤
│                         Tauri Command Controllers                                │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │ DOMAIN SERVICES LAYER                                                      │  │
│  │ ├── UnifiedDiscoveryService ──► PortDiscovery + ProcessDiscovery           │  │
│  │ ├── ProcessIdentityService  ──► RuntimeDetector + ProcessTreeBuilder       │  │
│  │ ├── ProcessControlService   ──► Win32 Kernel Controller + Safety Gates     │  │
│  │ ├── ServerProfileService    ──► SQLite Profile Repository                  │  │
│  │ ├── ServerStartService      ──► Windows/WSL Launchers + Readiness Polling  │  │
│  │ └── ProjectOrchestrator     ──► Sequential Orchestration Engine            │  │
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
| **Styling & UI Tokens** | [Tailwind CSS v4](https://tailwindcss.com/) (Dark Mode First) |
| **Automated Testing** | [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) (104 tests) & `cargo test` (118 tests) |

---

## 🚀 Getting Started

### Prerequisites

1. **Node.js** (v18+ LTS) & **npm**
2. **Rust & Cargo** (1.78+ with MSVC toolchain on Windows):
   ```powershell
   winget install Rustlang.Rustup
   ```
3. **Microsoft C++ Build Tools** & **WebView2** (included with Windows 10/11)
4. **WSL 2** *(Optional)*: If you wish to manage Linux development servers.

### Installation

```bash
# Clone the repository
git clone https://github.com/Arun-kushwaha007/DevHub.git
cd DevHub

# Install frontend dependencies
npm install
```

### Running Locally

```bash
# Run Tauri desktop app in development mode with HMR
npm run tauri dev

# Run only Vite frontend in browser
npm run dev
```

---

## 🧪 Testing & Verification

DevHub enforces a strict test-driven quality standard with **222 automated tests**:

```bash
# Run Rust backend unit & integration tests (118 tests)
cd src-tauri
cargo test

# Run frontend unit & component tests (104 tests)
npm test

# Run strict TypeScript typecheck and production build
npm run build
```

---

## 📁 Repository Structure

```
DevHub/
├── src/                          # React 19 Frontend
│   ├── components/               # UI Design System & Modals
│   │   ├── adoption/             # AdoptionFormModal, DuplicateProfileWarning
│   │   ├── common/               # Toast, CopyButton, EmptyState, LoadingState, ErrorState
│   │   ├── dashboard/            # ServerCard, ServerList, ServerToolbar, SummaryCards, 
│   │   │                         # ServerDetailsModal, StopConfirmationModal, ProcessTree
│   │   ├── profiles/             # ProfileCard, ProfileFormModal, DeleteProfileModal, PortConflictModal
│   │   ├── projects/             # ProjectCard, ProjectDetailsModal, ProjectFormModal, 
│   │   │                         # AddProfileModal, DeleteProjectModal, RemoveProfileModal, ProgressModal
│   │   ├── ports/                # PortTable, PortDetailsModal
│   │   ├── processes/            # ProcessTable, ProcessDetailsModal
│   │   ├── Sidebar.tsx           # 5-Route navigation sidebar with shortcut hints
│   │   ├── Header.tsx            # Top header with breadcrumbs and live status
│   │   └── Layout.tsx            # App shell with global keyboard shortcuts
│   ├── pages/                    # Main views (Dashboard, Servers, Profiles, Projects, Settings)
│   ├── types/                    # Strongly-typed cross-language TypeScript contracts
│   ├── lib/                      # API client (commands.ts), Pipeline (serverUtils.ts), Adoption (profileAssociation.ts)
│   ├── App.tsx                   # App root with initialization health check
│   └── index.css                 # Tailwind CSS v4 styling & dark theme tokens
├── src-tauri/                    # Rust Native Backend Core
│   ├── src/
│   │   ├── commands/             # Tauri IPC controllers (system, control, profiles, project, wsl, ports, processes)
│   │   ├── db/                   # SQLite persistence, schema migrations, and repository pattern
│   │   ├── discovery/            # Win32 IP Helper, Toolhelp snapshot, and unified discovery
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
├── LEARNING.md                   # Cumulative Engineering Learning Guide (129 Chapters)
├── RELEASE_CHECKLIST.md          # MVP Release Verification Matrix
├── RELEASE_NOTES.md              # Version 0.1.0 Release Notes
└── README.md                     # Project Presentation & Documentation
```

---

## 📚 Engineering Documentation

* **[ARCHITECTURE.md](ARCHITECTURE.md)** — In-depth architectural blueprint covering domain invariants, Win32 FFI, POSIX signals, TOCTOU safety, sequential orchestration, and concurrency locks.
* **[LEARNING.md](LEARNING.md)** — 129-chapter comprehensive engineering learning guide covering OS internals, networking theory, system design, HLD/LLD interview preparation, and code traces.
* **[PRD.md](doc/PRD.md)** — Complete Product Requirements Document.
* **[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)** — MVP verification matrix.
* **[RELEASE_NOTES.md](RELEASE_NOTES.md)** — Release notes and changelog.

---

## 📄 License

Licensed under either of [Apache License, Version 2.0](LICENSE-APACHE) or [MIT License](LICENSE-MIT) at your option.
