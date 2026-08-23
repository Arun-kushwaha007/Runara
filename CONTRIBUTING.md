# Contributing to Runara

Thank you for your interest in contributing to Runara!

**Runara** is a high-performance, native Windows desktop application that gives developers a centralized control layer for discovering, identifying, starting, stopping, restarting, and organizing local development servers across native Windows and WSL 2 Linux distributions.

We welcome contributions from the community—whether fixing a bug, adding test coverage, improving documentation, enhancing accessibility, or proposing small, well-scoped improvements.

---

## 1. Before Contributing

To keep development aligned and maintain high quality, please review the project documentation before opening pull requests:

* **[README.md](README.md)** — Project overview, feature breakdown, and quick-start instructions.
* **[PRD.md](doc/PRD.md)** — Product Requirements Document defining current capabilities, non-goals, and milestone acceptance criteria.
* **[ARCHITECTURE.md](ARCHITECTURE.md)** — Systems architecture blueprint covering Win32 FFI, POSIX signal semantics, TOCTOU safety invariants, and sequential orchestration.
* **[LEARNING.md](LEARNING.md)** — Comprehensive cumulative engineering guide covering OS internals, networking theory, system design, and code traces.

> [!IMPORTANT]
> **Respect Project Scope**: Runara v0.1.0 focuses exclusively on local development server management across Windows and WSL 2. Please avoid implementing features outside the current product scope (e.g. remote servers, Docker/Kubernetes management, cloud deployments) without prior discussion. Do not modify `doc/PRD.md` casually.

---

## 2. Development Requirements

To build and run Runara locally, ensure your environment meets the following prerequisites:

| Requirement | Recommended / Verified Version | Notes |
| :--- | :--- | :--- |
| **Operating System** | Windows 10 or Windows 11 (64-bit x86_64) | Primary target platform for native Win32 FFI APIs |
| **Node.js** | Node.js 18+ LTS (v18, v20, or v22) | JavaScript runtime for Vite bundler and tooling |
| **Package Manager** | `npm` (bundled with Node.js) | Uses repository `package-lock.json` |
| **Rust & Cargo** | Rust 1.78+ (2021 Edition) | MSVC toolchain (`x86_64-pc-windows-msvc`) |
| **C++ Build Tools** | Microsoft C++ Build Tools | Required for compiling native Rust dependencies |
| **WebView2** | Microsoft Edge WebView2 Runtime | Standard on Windows 10/11; required by Tauri |
| **WSL 2** *(Optional)* | WSL 2 with any Linux distribution | Required only if testing WSL discovery and guest orchestration |

*(Note: Dependencies are managed via `package.json` and `Cargo.toml`. Specific package patch versions are not pinned beyond declared manifest ranges).*

---

## 3. Getting Started & Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/Arun-kushwaha007/DevHub.git
cd DevHub
```

### Step 2: Install Frontend Dependencies
```bash
npm install
```

### Step 3: Verify Rust & Toolchain Prerequisites
```bash
rustc --version
cargo --version
```

### Step 4: Run the Application in Development Mode
```bash
# Starts Vite frontend dev server with Hot Module Replacement (HMR)
# and launches the Tauri desktop window
npm run tauri dev
```

---

## 4. Development Commands

Use the following verified commands during development:

| Purpose | Command | Description |
| :--- | :--- | :--- |
| **Install Dependencies** | `npm install` | Installs frontend dependencies |
| **Frontend Dev Server** | `npm run dev` | Runs standalone Vite dev server at `http://localhost:1420` |
| **Full Desktop Dev Mode** | `npm run tauri dev` | Runs desktop application with live backend & HMR frontend |
| **TypeScript & Build** | `npm run build` | Runs strict `tsc` type check and builds production bundle |
| **Frontend Tests** | `npm test` | Runs all 147 Vitest unit and component tests (`vitest run`) |
| **Frontend Test Watch** | `npm run test:watch` | Runs Vitest in interactive watch mode for TDD |
| **Rust Check** | `cargo check` *(in `src-tauri`)* | Type-checks Rust backend and validates borrow checker |
| **Rust Tests** | `cargo test` *(in `src-tauri`)* | Runs all 133 Rust backend unit and integration tests |
| **Rust Formatting Check** | `cargo fmt --check` *(in `src-tauri`)* | Verifies Rust formatting against `rustfmt.toml` |
| **Production Build** | `npx tauri build` | Builds optimized `.exe`, NSIS setup installer, and MSI package |

---

## 5. Project Architecture

Runara strictly decouples the native operating system layer from the React user interface:

```
┌───────────────────────────────────────────────────────────┐
│                 REACT 19 + TAILWIND V4 UI                 │
│        Dashboard • Servers • Profiles • Projects          │
└─────────────────────────────┬─────────────────────────────┘
                              │ Tauri 2 IPC (JSON-RPC)
┌─────────────────────────────▼─────────────────────────────┐
│                 NATIVE RUST BACKEND CORE                  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ DOMAIN SERVICES LAYER                               │  │
│  │ • UnifiedDiscoveryService • ProcessIdentityService  │  │
│  │ • ProcessControlService   • ServerProfileService    │  │
│  │ • ServerStartService      • ProjectOrchestrator     │  │
│  │ • FilesystemService                                 │  │
│  └──────────────────────────┬──────────────────────────┘  │
│                             │                             │
│  ┌──────────────────────────┴──────────────────────────┐  │
│  │ INFRASTRUCTURE ADAPTERS & PERSISTENCE               │  │
│  │ • Win32 IP Helper FFI (`GetExtendedTcpTable`)       │  │
│  │ • Win32 Kernel32 FFI  (`OpenProcess`, `Terminate`)  │  │
│  │ • WSL 2 Subsystem Driver (`wsl.exe`, POSIX signals) │  │
│  │ • Embedded SQLite 3 (WAL Mode, Migrations)          │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

For comprehensive technical specifications, invariants, and sequence diagrams, refer to **[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## 6. Code Organization

The repository follows a clean, modular structure:

```
Runara/
├── src/                          # React 19 Frontend
│   ├── components/               # Domain-specific UI components & modals
│   │   ├── adoption/             # AdoptionFormModal, DuplicateProfileWarning
│   │   ├── common/               # Toast, CopyButton, WorkingDirectoryField, DirectoryBrowser
│   │   ├── dashboard/            # ServerCard, ServerList, ServerToolbar, StopConfirmationModal
│   │   ├── ports/                # PortTable, PortDetailsModal
│   │   ├── processes/            # ProcessTable, ProcessDetailsModal
│   │   ├── profiles/             # ProfileCard, ProfileFormModal, PortConflictModal
│   │   ├── projects/             # ProjectCard, ProjectDetailsModal, ProgressModal
│   │   ├── Sidebar.tsx           # Global navigation sidebar
│   │   ├── Header.tsx            # Top breadcrumb bar & status telemetry
│   │   └── Layout.tsx            # App shell with keyboard shortcuts
│   ├── pages/                    # Main views (Dashboard, Servers, Profiles, Projects, Settings)
│   ├── context/                  # ThemeContext (Dark, Light, System Sync)
│   ├── lib/                      # API client (commands.ts), Pipeline (serverUtils.ts), Theme (theme.ts)
│   ├── types/                    # Strongly-typed TypeScript domain contracts
│   ├── App.tsx                   # Root component with initialization & fatal error recovery
│   └── index.css                 # Tailwind CSS v4 variables & semantic theme tokens
├── src-tauri/                    # Native Rust Backend Core
│   ├── src/
│   │   ├── commands/             # Tauri IPC command controllers
│   │   ├── db/                   # SQLite persistence, schema migrations, and repository pattern
│   │   ├── discovery/            # Win32 socket table scanner, process discovery, unified aggregator
│   │   ├── filesystem/           # Win32 folder chooser & WSL guest directory browser
│   │   ├── identity/             # Process identity classifier, runtime detector, ancestry tree
│   │   ├── launcher/             # Cross-environment process launchers (Windows cmd.exe / WSL sh)
│   │   ├── models/               # Strongly-typed Serde domain models (camelCase serialized)
│   │   ├── process/              # Win32 kernel process control, 7-signal pre-termination gate
│   │   ├── profile/              # Server profile lifecycle, launch polling, adoption heuristics
│   │   ├── project/              # Multi-service project orchestrator & concurrency guards
│   │   ├── windows/              # Native Win32 FFI bindings (networking.rs, process.rs)
│   │   ├── wsl/                  # WSL 2 subsystem adapter (distro, executor, port, process, control)
│   │   ├── lib.rs                # Tauri handler registry & dependency injection
│   │   └── main.rs               # Desktop executable entry point
│   ├── Cargo.toml                # Rust dependencies and package configuration
│   └── tauri.conf.json           # Window configuration, capabilities, and bundler targets
├── doc/
│   └── PRD.md                    # Product Requirements Document
├── ARCHITECTURE.md               # Systems Architecture Specification
├── LEARNING.md                   # Cumulative Engineering Learning Guide (160+ Chapters)
├── RELEASE_CHECKLIST.md          # Verification Matrix
└── README.md                     # Project Presentation
```

---

## 7. Types of Contributions

We welcome contributions in the following areas:

* 🐛 **Bug Fixes**: Resolving unexpected crashes, edge-case socket parsing bugs, or state synchronization issues.
* 🧪 **Testing**: Adding unit, integration, or end-to-end tests for frontend components, hooks, or Rust services.
* 📖 **Documentation**: Clarifying explanations, fixing typos, or improving architectural diagrams.
* ♿ **Accessibility & UX**: Improving keyboard navigation, screen reader labels, or visual contrast.
* ⚡ **Performance**: Optimizing socket discovery loops, reducing memory footprints, or eliminating unnecessary re-renders.
* 🎨 **UI Polish**: Enhancing component layouts and animations while strictly respecting semantic design tokens.
* 🛡️ **Safety Guardrails**: Hardening process verification gates against TOCTOU and PID reuse vulnerabilities.

---

## 8. Issue First for Large Changes

To avoid duplicate work or misaligned architectures, please **open an issue or discussion first** before beginning work on large changes, such as:

* Adding support for new operating systems or environments.
* Modifying kernel process-control or termination strategies.
* Changing multi-service sequential project orchestration logic.
* Altering SQLite database schemas or introducing new migration versions.
* Making major UI architectural shifts or adding new navigation routes.
* Introducing third-party external integrations or background services.

---

## 9. Branching Strategy

We follow a simple, branch-based workflow:

* `main` — Contains stable, release-ready code.
* `feature/<short-description>` — For new features or non-breaking enhancements.
* `fix/<short-description>` — For bug fixes and regression resolutions.
* `docs/<short-description>` — For documentation updates and learning guide chapters.

---

## 10. Commit Message Guidelines

Use clear, descriptive commit messages following the Conventional Commits pattern:

* `feat: add WSL process tree visualization modal`
* `fix: handle stale PID reuse during rapid server restart`
* `docs: update ARCHITECTURE.md with sequential teardown sequence`
* `refactor: simplify ServerProfileRepository error mapping`
* `test: add unit tests for ThemeContext system sync listener`

---

## 11. Pull Request Guidelines

When submitting a pull request, ensure it includes:

1. **Summary**: A concise explanation of what was changed and why.
2. **Testing**: Concrete commands executed and evidence of passing automated tests (unit, integration, or manual verification).
3. **Screenshots / Recordings**: Required for any visual UI changes across both **Dark Mode** and **Light Mode**.
4. **Platform Verification**: State whether the change was tested on Windows host, WSL 2, or both.
5. **Database Implications**: Note whether SQLite schema migrations are involved.
6. **Focus**: Keep pull requests focused on a single topic. Avoid bundling unrelated refactorings.

---

## 12. Guidelines for Specific Areas

### 12.1 UI & Styling
* Use the existing design token system defined in [`src/index.css`](src/index.css).
* Always test visual changes in all three theme modes: **Dark Mode** (`#101010`), **Light Mode** (`#F9F9F9`), and **System Sync**.
* Do not introduce additional CSS frameworks or styling libraries.
* Maintain consistent component spacing, typography, and status semantics (Emerald for Running, Amber for Stopping/Unmanaged, Red for Error/AccessRestricted, Blue for Info).

### 12.2 Process Control & Safety Invariants
Because Runara directly terminates operating system processes, safety is paramount:
* **7-Signal Pre-Termination Gate**: Never terminate a process based solely on port number. Always verify PID, process name, executable path, command line, and working directory.
* **Ancestor Guardrails**: Never terminate parent shells (`pwsh.exe`, `cmd.exe`, `bash`, `zsh`) or developer IDEs (`Code.exe`, IDE server).
* **Leaf Worker BFS**: Terminate child process trees safely using reverse bottom-up traversal.
* Never weaken verification checks for convenience. Add regression tests for any process control changes.

### 12.3 WSL Subsystem Integration
* Always treat WSL as an independent Linux guest environment. Do not conflate Windows host PIDs with Linux guest PIDs.
* Explicitly specify the target WSL distribution (e.g. `wsl.exe -d <distro>`).
* Handle stopped distributions and missing Linux utilities (`ss`, `ps`) gracefully without crashing or freezing.

### 12.4 Database & Persistence
* Database persistence uses SQLite 3 with Write-Ahead Logging (WAL) and foreign key constraints.
* Any schema change requires a new sequential migration in `src-tauri/src/db/migration.rs`.
* Never modify existing, published migrations destructively.
* Never commit local `.db`, `.db-wal`, or `.db-shm` development files.

---

## 13. Security Guidelines

Runara operates with standard user desktop privileges:

* **No Hardcoded Secrets**: Never commit API keys, personal tokens, private certificates, or absolute personal directory paths.
* **Direct Argument Vectors**: Never pass unescaped user strings directly to shell interpolations. Always construct structured argument vectors (e.g. `std::process::Command` args).
* **Environment Isolation**: Always isolate Windows and WSL process execution boundaries.

---

## 14. Code Style & Standards

* **TypeScript / React**: Strict TypeScript checking (`"strict": true` in `tsconfig.json`). No implicit `any`. Clean functional components with hooks.
* **Rust**: Format Rust backend code using `cargo fmt` in accordance with [`src-tauri/rustfmt.toml`](src-tauri/rustfmt.toml) (max line width 100). Address all `cargo clippy` compiler warnings.

---

## 15. Pre-Commit Checklist

Before opening a pull request, verify each item:

- [ ] Code compiles cleanly without errors.
- [ ] All TypeScript types check cleanly (`npm run build`).
- [ ] All 147 frontend tests pass (`npm test`).
- [ ] All 133 Rust backend tests pass (`cargo test` in `src-tauri`).
- [ ] Rust code formatting conforms to `rustfmt.toml` (`cargo fmt --check`).
- [ ] No temporary debugging logs, commented-out code, or secrets remain.
- [ ] Documentation (`README.md`, `ARCHITECTURE.md`, `LEARNING.md`) is updated if behavior changed.
- [ ] UI changes have been tested in Dark, Light, and System themes with screenshots attached.

Thank you for helping make Runara the best local development control center for developers!
