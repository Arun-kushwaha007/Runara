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

## 🛠️ Technology Stack

- **Desktop Framework:** [Tauri 2](https://v2.tauri.app/)
- **Native Backend:** [Rust](https://www.rust-lang.org/)
- **Frontend Framework:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler:** [Vite](https://vite.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)

---

## 📍 Current Status

**Milestone 0: Project Foundation (Complete)**
- Initial desktop application shell and navigation structure
- React + TypeScript + Vite + Tailwind CSS frontend pipeline
- Tauri 2 + Rust native backend configuration
- Verified React ↔ Tauri/Rust IPC communication
- Windows desktop executable build verified

*Next Milestone: Milestone 1 — Windows Process Discovery*

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
│   ├── components/           # Reusable UI components (Sidebar, Header, Layout)
│   ├── pages/                # Application views (Dashboard, Servers, Projects, Settings)
│   ├── hooks/                # React custom hooks
│   ├── stores/               # State management
│   ├── types/                # TypeScript interface definitions
│   ├── lib/                  # Utilities and typed Tauri command wrappers
│   ├── App.tsx               # Main application component
│   ├── main.tsx              # React DOM entry point
│   └── index.css             # Tailwind CSS entry & dark theme styles
├── src-tauri/                # Rust Native Backend
│   ├── src/
│   │   ├── commands/         # Tauri IPC commands (e.g. system info)
│   │   ├── discovery/        # Process and port discovery (Milestones 1-3)
│   │   ├── process/          # Process control (Milestone 5)
│   │   ├── wsl/              # WSL distribution integration (Milestone 6)
│   │   ├── windows/          # Windows OS APIs
│   │   ├── db/               # Persistence layer
│   │   ├── models/           # Domain models
│   │   ├── lib.rs            # Tauri application entry point & handler registry
│   │   └── main.rs           # Desktop binary entry
│   ├── Cargo.toml            # Rust dependencies and package configuration
│   └── tauri.conf.json       # Tauri window and build configuration
└── doc/
    └── PRD.md                # Product Requirements Document
```

---

## 📄 License

Private / Proprietary.
