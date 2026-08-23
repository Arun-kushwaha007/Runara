# Runara v0.1.0 Release Verification Checklist

```
Product:        Runara — Local Development Control Center
Version:        0.1.0 (First Public Release)
Target OS:      Windows 10 / Windows 11 (64-bit)
Platform:       Windows + WSL 2 (x86_64)
Verified Date:  2026-08-23
Release Status: Verified & Ready for Distribution
```

---

## 1. Code Quality & Test Suite

- [x] **Rust Backend Tests Pass**: 133/133 tests passing (`cargo test` in `src-tauri` with zero failures, zero warnings).
- [x] **Frontend Tests Pass**: 147/147 tests passing across 17 test suites (`npm test` via Vitest).
- [x] **Total Automated Tests**: 280 automated tests passing with 100% green status.
- [x] **No Debug Code / Console Spam**: Production logger and IPC channels stripped of unnecessary debug prints.
- [x] **No Placeholder UI**: Real process telemetry, real socket tables, real SQLite profile storage.
- [x] **No Dead Controls**: All buttons, links, search filters, and modals are wired to live IPC endpoints.
- [x] **No Secrets or Private Paths**: Automated grep scan confirmed zero embedded credentials, API keys, internal IPs, or machine-specific developer usernames.

---

## 2. Platform & OS Integration

- [x] **Windows Build Passes**: Optimized production release compiled with Rust MSVC toolchain (`opt-level = 3`).
- [x] **Win32 Socket Discovery**: Sub-millisecond IP Helper API (`GetExtendedTcpTable`) active on IPv4 and IPv6.
- [x] **Windows Process Control**: 7-signal pre-termination verification, PID reuse guardrails, ancestor protection (`cmd.exe`, `pwsh.exe`, `Code.exe`).
- [x] **WSL Discovery Passes**: Native interop with `wsl.exe -l -v`, parsing UTF-16LE/UTF-8 output across Ubuntu, Debian, Fedora, Arch.
- [x] **WSL Process Control Passes**: Structured argument vectors passed directly to `/bin/kill` with graceful `SIGTERM` (15) and uncatchable `SIGKILL` (9).
- [x] **Cross-Environment PID Disambiguation**: Composite `(Environment, PID)` keys prevent cross-environment signal misdirection.

---

## 3. Database & Schema Migrations

- [x] **Fresh Database Initialization**: Automatic folder creation and SQLite initialization with WAL mode (`PRAGMA journal_mode = WAL`).
- [x] **Schema Migration Runner**: Strictly ordered sequential migration transactions (`001_create_server_profiles`, `002_create_projects`).
- [x] **Existing Profile Data Survives**: Verified in integration tests (`test_migration_upgrades_existing_database_with_profiles`).
- [x] **Existing Project Data Survives**: Project groupings, profile memberships, and order indices preserved across schema upgrades.
- [x] **Corrupted Storage Recovery**: Explicit user error screen with Retry and Exit actions; no silent creation of empty temporary databases.

---

## 4. User Experience & Features

- [x] **Dark Theme (#101010 background / #CCCCCC foreground)**: High-contrast, accessibility-checked dark theme tokens.
- [x] **Light Theme (#F9F9F9 background / #101010 foreground)**: High-contrast, clean light theme tokens.
- [x] **Theme Persistence & Zero-Flash Startup**: Synchronous DOM attribute initialization pre-mount + `matchMedia` live OS sync.
- [x] **Native Windows Folder Picker**: Native Win32 dialog integration via `@tauri-apps/plugin-dialog`.
- [x] **WSL Guest Directory Browser**: Live interactive filesystem explorer for active WSL distributions.
- [x] **Server Profile Lifecycle**: Create, edit, delete, launch, stop, and restart with pre-flight port conflict detection.
- [x] **Server Adoption Flow**: Multi-signal matching of unmanaged background servers with editable adoption drafts.
- [x] **Multi-Service Projects**: Grouping microservices with gapless order index management.
- [x] **Start All (Sequential Orchestration)**: Desired-state startup skipping already-running servers with fail-fast stopping.
- [x] **Stop All (Reverse-Order Teardown)**: Graceful shutdown in reverse dependency sequence.
- [x] **Restart All**: Complete teardown and sequential rebuild across mixed Windows and WSL services.
- [x] **In-Flight Operation Locking**: In-memory mutex guards prevent race conditions and duplicate concurrent operations.

---

## 5. Security & Safety Review

- [x] **Process-Control Safety Gate**: Verified target PID, name, working directory, and executable path before termination.
- [x] **Shell Injection Prevention**: Direct structured argument vectors passed to OS processes (`wsl.exe`, `cmd.exe`) without shell expansion.
- [x] **Path Handling**: Normalized paths for Windows backslashes and POSIX slashes; canonical path traversal protection.
- [x] **Web Security Boundary**: Tauri 2 IPC isolation without Node.js or remote webview execution; safe localhost URL resolution.
- [x] **Secret & Credential Scan**: No API keys, passwords, bearer tokens, or sensitive machine paths in repository source or assets.

---

## 6. Documentation Suite

- [x] **`README.md`**: Public presentation with value proposition, verified features, architecture diagram, tech stack, and installation guide.
- [x] **`PRD.md` (`doc/PRD.md`)**: Product Requirements Document maintained as the single functional source of truth.
- [x] **`ARCHITECTURE.md`**: Complete system architecture specification with domain invariants, FFI details, and security model.
- [x] **`LEARNING.md`**: Comprehensive 160+ chapter engineering textbook preserving all Milestones 0–14 concepts plus Milestone 15 release engineering.
- [x] **`RELEASE_NOTES.md`**: Public v0.1.0 release notes with detailed changelog, SHA256 checksums, and system requirements.

---

## 7. Distribution & Packaging

- [x] **Version Synchronized**: Authoritatively set to `0.1.0` in `package.json`, `Cargo.toml`, `tauri.conf.json`, and UI diagnostics.
- [x] **Application Branding & Metadata**: Product name "Runara", identifier `com.runara.desktop`, custom Runara application icon.
- [x] **Windows MSI Installer Built**: `Runara_0.1.0_x64_en-US.msi` (4.69 MB).
- [x] **Windows NSIS Installer Built**: `Runara_0.1.0_x64-setup.exe` (3.44 MB).
- [x] **Portable Standalone Executable**: `Runara.exe` (8.19 MB).
- [x] **Release Checksums Calculated**: SHA-256 hashes generated for all release binaries.
- [x] **Clean Install Verified**: Standalone execution verified without requiring developer tools (Node.js, Rust, or Tauri CLI).

---

## 8. Public Release Preparation

- [x] **Release Notes Ready**: Formatted markdown changelog with checksums and feature matrix.
- [x] **Demo Scenario Structured**: "Local Platform" multi-service workflow (Frontend, Backend, ML Server, Worker across Windows & WSL).
- [x] **GitHub Release Ready**: Tag `v0.1.0` prepared with binary attachments.
- [x] **Product Hunt & Portfolio Assets Ready**: Tagline, problem statement, architecture highlights, and screenshots prepared.
