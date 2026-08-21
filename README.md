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
- **[Engineering Learning Guide (LEARNING.md)](LEARNING.md)** — Comprehensive educational guide covering CS fundamentals, Windows systems programming, HLD/LLD architecture, cross-language IPC, and code traces for interview preparation.

---

## 🛠️ Technology Stack

- **Desktop Framework:** [Tauri 2](https://v2.tauri.app/)
- **Native Backend:** [Rust](https://www.rust-lang.org/)
- **Frontend Framework:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler:** [Vite](https://vite.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)

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
  - Interactive process inspection dashboard with real-time search, sorting, auto-refresh polling, and process details modal
  - Comprehensive unit and integration test coverage
  - In-depth engineering learning guide (`LEARNING.md`)

*Next Milestone: Milestone 2 — Windows Port Discovery*

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
# Run Rust backend unit and integration tests
cd src-tauri
cargo test -- --nocapture

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
│   │   ├── processes/        # ProcessTable, ProcessDetailsModal
│   │   ├── Sidebar.tsx       # Navigation sidebar
│   │   ├── Header.tsx        # Top header
│   │   └── Layout.tsx        # App layout shell
│   ├── pages/                # Application views (Dashboard, Servers, Projects, Settings)
│   ├── hooks/                # React custom hooks
│   ├── types/                # TypeScript interface definitions (process.ts, index.ts)
│   ├── lib/                  # Typed Tauri command wrappers & API client (commands.ts)
│   ├── App.tsx               # Main application component
│   ├── main.tsx              # React DOM entry point
│   └── index.css             # Tailwind CSS entry & dark theme styles
├── src-tauri/                # Rust Native Backend
│   ├── src/
│   │   ├── commands/         # Tauri IPC commands (processes.rs, system.rs)
│   │   ├── discovery/        # Process discovery service (process.rs)
│   │   ├── models/           # Domain models (process.rs)
│   │   ├── windows/          # Windows OS APIs
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
