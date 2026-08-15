# DevHub

## Product Requirements Document

Version: 1.0
Status: MVP Development Specification
Target Platform: Windows
Primary Environment: Windows + WSL
Primary User: Software developers running multiple local development projects
Primary Goal: Build a polished developer desktop application that discovers, identifies, starts, stops, restarts, and organizes local development servers across Windows and WSL from one interface.

---

# 1. Product Overview

DevHub is a native Windows desktop application for managing local development servers.

The target user runs multiple frontend applications, backend services, workers, AI-generated development servers, and projects across Windows and WSL. Their current workflow depends on many VS Code windows, terminals, desktop workspaces, browser tabs, and AI coding agents.

The core problem is visibility and control.

A developer often knows:

“I need port 3000.”

But does not immediately know:

“Which process currently owns port 3000?”

The current workflow requires:

1. Find the correct terminal.
2. Identify which project is running.
3. Determine the process or port.
4. Search for the PID.
5. Kill the process manually.
6. Start the desired project.
7. Deal with Windows versus WSL differences.
8. Repeat this several times during a workday.

DevHub creates a centralized control layer above those processes.

The product should make local development environments visible and manageable from one desktop application.

---

# 2. Product Vision

DevHub should feel like a control center for a developer’s local machine.

The user should open the application and immediately understand:

1. What development servers are running.
2. Which port each server owns.
3. Which project each server belongs to.
4. Which operating environment owns the process.
5. Which command started it.
6. Where the project lives.
7. Which PID and process tree are responsible.
8. Whether the server is running in Windows or WSL.
9. How to stop it.
10. How to start it again.

The user should no longer need to search through terminals to find running servers.

---

# 3. Product Positioning

DevHub is not primarily:

A port scanner.

A process killer.

A terminal replacement.

A Docker replacement.

A task manager.

A remote server manager.

It is a local development environment control center.

The central abstraction is:

Server → Project → Environment → Process

A port is only one piece of information.

The product should identify the server behind the port.

---

# 4. Target User

Primary user:

A software developer on Windows who works on multiple repositories and frequently uses:

React
Node.js
Vite
Next.js
Express
Python
FastAPI
Django
npm
pnpm
yarn
VS Code
Cursor
AI coding agents
WSL
Linux distributions

The initial user profile especially includes developers working with company repositories where several frontend and backend projects need to run simultaneously.

---

# 5. User Problems

## Problem 1: Server discovery

The user has several desktops and terminals.

They cannot easily remember which terminal owns a particular server.

Required solution:

A centralized list of all detected development servers.

---

## Problem 2: Port ownership

The user needs port 3000, but another process already owns it.

Required solution:

Show:

Port
PID
Process
Command
Working directory
Project
Environment

---

## Problem 3: Windows and WSL fragmentation

Some projects run in Windows.

Other projects run in WSL.

The user treats both environments as part of one development machine.

Required solution:

Normalize Windows and WSL servers into one unified UI.

---

## Problem 4: AI agents create temporary servers

Coding agents frequently start development servers while testing applications.

The user often does not know which process the agent created.

Required solution:

Detect unknown servers and expose enough information to identify them.

Provide “Adopt” and “Stop” actions.

---

## Problem 5: Starting projects

After stopping a server, the user still has to find the repository and open a terminal.

Required solution:

Allow saved server profiles to start development commands from DevHub.

---

## Problem 6: Multi-service projects

A project might contain:

Frontend
Backend
Worker
Database helper
Other development services

Required solution:

Group related server profiles into projects.

---

# 6. MVP Definition

The MVP is complete when the application supports all of the following:

1. Discover Windows processes.
2. Discover Windows listening ports.
3. Associate ports with owning processes.
4. Identify useful process metadata.
5. Build process trees.
6. Detect Windows development servers.
7. Display servers in a centralized dashboard.
8. Stop servers.
9. Force-stop servers when necessary.
10. Discover WSL distributions.
11. Discover WSL processes.
12. Discover WSL listening ports.
13. Display Windows and WSL servers together.
14. Start saved Windows server profiles.
15. Start saved WSL server profiles.
16. Automatically detect newly started servers.
17. Adopt discovered servers as saved profiles.
18. Group server profiles into projects.
19. Start, stop, and restart project groups.
20. Provide polished desktop UI.
21. Provide browser, terminal, and VS Code launch actions.
22. Persist configuration locally.

---

# 7. MVP Non-Goals

Do not implement these during the MVP:

Docker management.

Kubernetes management.

Remote server management.

Cloud deployment.

Authentication.

User accounts.

Cloud synchronization.

Team collaboration.

Centralized logging service.

CI/CD management.

Production monitoring.

Database administration.

Container orchestration.

Server deployment.

Automatic code modification.

AI-generated project configuration.

The goal is to solve local development server management extremely well.

---

# 8. Recommended Technology Stack

Frontend:

React
TypeScript
Vite
Tailwind CSS

Desktop:

Tauri 2

Native backend:

Rust

Persistence:

SQLite

Windows integration:

Rust native process APIs where practical.

PowerShell and Windows command-line tools during early implementation where practical.

WSL integration:

wsl.exe initially.

Linux commands executed through the selected WSL distribution.

The frontend must not contain OS-specific process management logic.

The Rust backend owns operating system interaction.

---

# 9. High-Level Architecture

Use the following architecture:

React UI
↓
Tauri IPC
↓
Rust application core
↓
Discovery layer
↓
Process control layer
↓
Windows OS / WSL
↓
SQLite persistence

Detailed architecture:

Frontend:

Pages
Components
State
Hooks
UI models

Tauri:

Commands
Events
Window management
Native integrations

Rust Core:

Process Discovery
Port Discovery
Process Tree
Process Control
Windows Integration
WSL Integration
Server Manager
Project Manager
Persistence

---

# 10. Architectural Principle

The application must normalize different operating environments into one internal model.

React must never need to know whether a server was discovered using:

netstat
PowerShell
Windows API
wsl.exe
ss
ps

The discovery implementation returns a normalized ServerProcess object.

Example:

{
"id": "proc_123",
"source": "windows",
"distro": null,
"pid": 18240,
"parentPid": 17820,
"port": 3000,
"protocol": "tcp",
"processName": "node.exe",
"commandLine": "npm run dev",
"executable": "node.exe",
"cwd": "C:\Projects\frontend",
"status": "running"
}

WSL:

{
"id": "proc_456",
"source": "wsl",
"distro": "Fedora",
"pid": 421,
"parentPid": 390,
"port": 5000,
"protocol": "tcp",
"processName": "node",
"commandLine": "npm run dev",
"executable": "/usr/bin/node",
"cwd": "/home/developer/projects/api",
"status": "running"
}

The UI receives the same conceptual object.

---

# 11. Core Domain Models

## ServerProcess

Fields:

id
source
distro
pid
parentPid
port
protocol
processName
commandLine
executable
cwd
status
cpu
memory
startedAt
detectedAt

source values:

windows
wsl

status values:

running
stopping
stopped
unknown
error

---

## ServerProfile

Represents a server the user knows how to start.

Fields:

id
name
description
source
distro
cwd
command
expectedPort
runtime
autoDetect
createdAt
updatedAt

Example:

{
"name": "Company Frontend",
"source": "windows",
"cwd": "C:\Projects\company-frontend",
"command": "npm run dev",
"expectedPort": 3000
}

---

## Project

Represents a group of related server profiles.

Fields:

id
name
description
serverProfileIds
createdAt
updatedAt

Example:

Project:

Company Platform

Services:

Frontend
Backend
Worker

---

# 12. Milestone Roadmap

The project must be implemented sequentially.

Each milestone has:

Goal
Tasks
Expected output
Acceptance criteria
Failure conditions

Do not skip milestones.

Do not build later features before the foundational requirements are verified.

---

# MILESTONE 0, PROJECT FOUNDATION

## Goal

Create the application skeleton and establish the development architecture.

## Tasks

0.1 Create repository.

0.2 Initialize React + TypeScript + Vite.

0.3 Initialize Tauri 2.

0.4 Configure Tailwind CSS.

0.5 Configure Rust project.

0.6 Establish frontend/backend communication.

0.7 Create base application shell.

0.8 Add navigation structure.

0.9 Add development scripts.

0.10 Create Windows production build.

0.11 Verify .exe launch.

## Initial UI

Sidebar:

Dashboard
Servers
Projects
Settings

Main area:

Placeholder dashboard.

## Acceptance Criteria

The application launches as a Windows desktop application.

React UI renders.

Tauri commands can be called from React.

Rust errors are surfaced cleanly.

Production build creates a working Windows executable.

Git repository is cleanly structured.

## Do not implement

Process discovery.

WSL.

Database.

Server controls.

---

# MILESTONE 1, WINDOWS PROCESS DISCOVERY

## Goal

Discover Windows processes.

## Tasks

1.1 Define Process model.

1.2 Query Windows processes.

1.3 Retrieve PID.

1.4 Retrieve process name.

1.5 Retrieve executable path.

1.6 Retrieve command line.

1.7 Retrieve parent PID.

1.8 Retrieve working directory where available.

1.9 Create Rust discovery service.

1.10 Expose discovery through Tauri command.

1.11 Display process list in development UI.

## Example Output

PID 18240
Process node.exe
Command npm run dev
Parent npm.cmd
Path C:\Program Files\nodejs\node.exe

## Acceptance Criteria

DevHub can retrieve real Windows processes.

At least node.exe, python.exe, npm-related processes, VS Code, terminals, and common developer processes appear when present.

PID values are correct.

Process name is correct.

Command line is correct where permission allows.

The application handles inaccessible process information without crashing.

---

# MILESTONE 2, WINDOWS PORT DISCOVERY

## Goal

Determine which processes own listening development ports.

## Tasks

2.1 Discover listening TCP ports.

2.2 Extract port.

2.3 Extract PID.

2.4 Match PID to process.

2.5 Ignore non-listening connections.

2.6 Normalize port information.

2.7 Add port information to ServerProcess.

2.8 Support automatic refresh.

## Example

Port 3000
PID 18240
node.exe

Port 5000
PID 19320
python.exe

Port 5173
PID 20012
node.exe

## Acceptance Criteria

The application correctly reports listening ports.

Each port maps to the correct PID.

Each PID maps to the correct process.

Refreshing updates the list.

Ports disappearing from the operating system disappear from the dashboard.

A process using several ports is represented correctly.

---

# MILESTONE 3, PROCESS IDENTITY

## Goal

Turn a PID and port into meaningful development server information.

## Tasks

3.1 Build parent-child process tree.

3.2 Traverse parent processes.

3.3 Determine process ancestry.

3.4 Capture command line.

3.5 Capture executable.

3.6 Capture working directory.

3.7 Detect common runtimes.

3.8 Detect package managers where possible.

3.9 Create server identity object.

## Runtime detection

Examples:

Node.js
Python
Java
Go
Rust
.NET

Package manager detection:

npm
pnpm
yarn
bun

## Example

Company Frontend

Port:
3000

PID:
18240

Runtime:
Node.js

Command:
npm run dev

Working Directory:
C:\Projects\company-frontend

Parent:
npm.cmd

Process Tree:

Code.exe
→ PowerShell
→ npm.cmd
→ node.exe

## Acceptance Criteria

The UI explains what a process is instead of showing only PID and port.

The process tree is internally available for debugging.

Working directory is shown when discoverable.

Command line is shown.

Parent process is shown.

---

# MILESTONE 4, SERVER DASHBOARD

## Goal

Create the primary user experience.

## Main screen

Header:

DevHub

Local Development Control Center

Metrics:

Running Servers
Windows
WSL
Listening Ports

Search bar.

Environment filter.

Status filter.

Sort options.

Server cards.

## Server card

Display:

Server name or inferred name.

Running state.

Port.

Runtime.

Working directory.

Command.

PID.

Environment.

WSL distribution where applicable.

Actions:

Open
Terminal
Stop

## UI States

Running.

Stopping.

Stopped.

Unknown.

Error.

Loading.

Empty.

## Search

Search by:

Server name
Port
PID
Command
Working directory
Runtime
Project

## Acceptance Criteria

The dashboard shows every detected development server.

The list updates without requiring app restart.

Search filters instantly.

Environment filtering works.

The dashboard remains usable with at least 50 detected processes.

No flickering during refresh.

---

# MILESTONE 5, PROCESS CONTROL

## Goal

Allow users to safely stop and restart development servers.

## Stop flow

User selects Stop.

Application shows confirmation.

Example:

Stop Company Frontend?

Port 3000
PID 18240
Command npm run dev

Actions:

Cancel
Stop Server

## Process termination

First attempt graceful termination.

Wait for process exit.

Check whether children remain.

If required, terminate process tree.

Update UI.

## Force Stop

Provide:

Force Stop

This is more aggressive and should be clearly differentiated.

## Restart

Restart means:

Stop existing process.

Wait until port/process is released.

Start associated profile when available.

Refresh discovery.

## Acceptance Criteria

Stopping a server removes it from the running list.

Child processes do not remain unexpectedly.

Force stop works when normal stop fails.

The UI clearly reports failure.

The application never terminates unrelated processes due to a port mismatch alone.

Before killing a process, verify its PID and process identity.

---

# MILESTONE 6, WSL INTEGRATION

## Goal

Treat WSL as a first-class development environment.

## Tasks

6.1 Detect installed WSL distributions.

6.2 Detect running distributions.

6.3 Allow selecting distribution.

6.4 Execute Linux commands through wsl.exe.

6.5 Discover WSL processes.

6.6 Discover WSL listening ports.

6.7 Retrieve WSL PID.

6.8 Retrieve command line.

6.9 Retrieve working directory.

6.10 Build WSL process tree.

6.11 Normalize WSL data.

6.12 Display WSL servers alongside Windows servers.

## Internal model

source:

wsl

distro:

Fedora

The UI must visually distinguish:

Windows

WSL / Fedora

## Example

Company API

Port:
5000

Runtime:
Node.js

Environment:
WSL

Distribution:
Fedora

PID:
421

Working Directory:
/home/developer/projects/api

Command:
npm run dev

## Acceptance Criteria

DevHub detects active WSL development servers.

Windows and WSL servers appear in the same dashboard.

The same UI works for both.

The application differentiates source and distribution.

A WSL server can be stopped from DevHub.

The application handles multiple WSL distributions.

The application handles a distribution that is not running.

---

# MILESTONE 7, SERVER PROFILES AND START

## Goal

Allow the developer to start known servers directly from DevHub.

## Add Server Profile

Fields:

Name

Environment

WSL distribution if applicable

Working directory

Command

Expected port

Description

## Example

Company Frontend

Environment:
Windows

Working directory:
C:\Projects\company-frontend

Command:
npm run dev

Expected port:
3000

## Start flow

User clicks Start.

DevHub starts the shell/process using the selected environment.

DevHub monitors the process.

DevHub waits for the server to begin listening.

When detected:

Profile status changes to Running.

## WSL start

Run command through selected WSL distribution.

Use configured working directory.

## Acceptance Criteria

Windows profile starts correctly.

WSL profile starts correctly.

The resulting server is discovered automatically.

Port becomes visible.

The profile connects to the discovered process.

Start failures are clearly reported.

Missing working directory is handled.

Missing command is rejected during profile creation.

---

# MILESTONE 8, ADOPT UNKNOWN SERVERS

## Goal

Allow users to convert discovered processes into saved server profiles.

This feature is important because AI agents and temporary development workflows create unknown processes.

## UI

Unknown Server

Port:
5173

PID:
22140

Runtime:
Node.js

Command:
npm run dev

Working directory:
C:\Temp\agent-workspace

Actions:

Inspect
Adopt
Stop

## Adopt flow

User clicks Adopt.

Open profile form with prefilled values.

Fields should be prepopulated:

Name
Environment
Distribution
Working directory
Command
Port

User edits name.

User saves.

Profile is persisted.

## Acceptance Criteria

Any discoverable server can be adopted.

Existing process information prepopulates the profile.

Saved profile detects the existing process.

Stopping the profile controls the correct process.

Adopted server remains available after application restart.

---

# MILESTONE 9, PROJECT GROUPS

## Goal

Allow multiple server profiles to form a logical development project.

## Example

Company Platform

Frontend
Port 3000
Windows

Backend
Port 5000
WSL / Fedora

Worker
No public port
WSL / Fedora

## Project status

Project should calculate:

Running
Partial
Stopped
Error

Example:

Company Platform

Partial

Frontend     Running
Backend      Running
Worker       Stopped

## Actions

Start Project

Stop Project

Restart Project

Open Project

## Start Project behavior

Start services in configured order.

Optional dependency order:

Backend before Frontend.

Expose configurable start order later if needed.

## Acceptance Criteria

A project can contain multiple server profiles.

Project status reflects child server statuses.

Start Project starts configured services.

Stop Project stops configured services.

Restart Project performs a proper stop/start sequence.

---

# MILESTONE 10, PRODUCT POLISH

## Goal

Turn the functional application into a product suitable for public demonstration.

## Visual requirements

Desktop-first layout.

Clean typography.

Clear hierarchy.

Dark mode as primary theme.

Optional light mode.

Consistent spacing.

Clear status indicators.

Minimal visual noise.

Professional icons.

Smooth state transitions.

## Required states

Loading.

Empty.

Error.

Running.

Stopping.

Starting.

Stopped.

Unknown.

No permission.

WSL unavailable.

Port conflict.

Process disappeared.

## Useful actions

Open browser.

Open terminal.

Open project in VS Code.

Copy port.

Copy PID.

Copy command.

Copy working directory.

## Keyboard shortcuts

Refresh.

Search.

Stop selected server.

Start selected server.

Focus search.

## System tray

After core functionality is stable, add a tray application mode.

The application should support:

Open DevHub.

Refresh.

Stop all managed servers.

Exit.

Do not implement tray functionality before the core server management system is stable.

---

# 13. Dashboard UX Specification

The primary dashboard should contain:

Top navigation.

Summary statistics.

Search/filter section.

Server list.

Optional grouped project section.

Each server card should answer these questions immediately:

What is running?

Where is it running?

Which port does it own?

What command started it?

Where is the project?

Which PID owns it?

What actions do I have?

---

# 14. Suggested Main Navigation

Dashboard

Servers

Projects

Activity

Settings

Activity may initially remain simple.

Example:

10:32
Started Company Frontend

10:35
Stopped AI Agent Server

10:36
Started Company API

Do not build advanced logging infrastructure in the MVP.

---

# 15. Server Status Logic

A server is Running when:

The process exists.

The configured process matches.

The server port is listening when the profile expects a port.

A server is Starting when:

The start command was issued but discovery has not yet confirmed the server.

A server is Stopping when:

A termination request has been issued but the process is still alive.

A server is Stopped when:

The process no longer exists.

A server is Error when:

The start operation failed.

The process exited unexpectedly.

The configured working directory is missing.

The command could not be executed.

---

# 16. Refresh Strategy

The application should periodically update process state.

Initial MVP approach:

Poll every 2 to 3 seconds.

Do not over-optimize prematurely.

Discovery must be separated from rendering.

The frontend should not call expensive process discovery directly for every component.

Create one centralized polling mechanism.

The backend should expose normalized state.

Later optimization:

Event-driven process monitoring.

Long-running WSL agent.

Native Windows process notifications.

These are post-MVP improvements.

---

# 17. Process Safety Requirements

This is a critical requirement.

Never identify a process solely by port.

Before stopping:

1. Obtain port owner PID.
2. Verify process exists.
3. Verify PID is still associated with expected process.
4. Verify process name where available.
5. Display command and working directory when available.
6. Request user confirmation for destructive actions.
7. Kill the correct process tree.

Avoid accidental termination of:

System services.

Unrelated applications.

Docker services.

IDE processes.

Another project using the same runtime.

Critical OS processes.

The application should fail safely if process identity is uncertain.

---

# 18. Port Conflict Handling

When starting a server whose expected port is already occupied:

Do not automatically kill the existing process.

Show:

Port 3000 is already in use.

Current process:

PID 18240
node.exe
C:\Projects/other-project
npm run dev

Actions:

Inspect Existing Server

Stop Existing Server

Cancel

Only terminate after explicit user action.

---

# 19. WSL Safety

WSL operations must always specify the target distribution when possible.

Never assume Fedora if multiple distributions exist.

Avoid commands that terminate all processes inside a distribution.

Operate on the specific discovered PID.

If WSL is unavailable:

Show a clear state.

Do not crash.

Do not repeatedly execute failing commands.

---

# 20. Persistence

Use SQLite for local application state.

Persist:
