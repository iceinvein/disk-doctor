# Disk Doctor

A fast, native macOS disk space analyzer. Find what's eating your storage and reclaim it with confidence.

Built with Tauri v2 (Rust backend + React frontend) to feel like a tool Apple would ship.

## Features

- **Parallel scanning** — Uses all CPU cores via rayon to scan directories concurrently
- **Live streaming** — See results as they come in, don't wait for the full scan
- **Virtualized file list** — Handles millions of entries without breaking a sweat
- **Category colors** — Files are color-coded by type (media, code, archives, documents, audio, system)
- **Batch operations** — Select multiple items and trash them at once
- **Safe deletion** — Everything goes to macOS Trash, never permanently deleted
- **Keyboard-driven** — Arrow keys, Cmd+A, Cmd+Backspace, Cmd+F, Shift+Click range select
- **Scan persistence** — Resume your last scan instantly via SQLite storage
- **Full Disk Access** — Optional guided setup for scanning your entire disk
- **Light + Dark mode** — Follows macOS system appearance automatically

## Requirements

- macOS 12+
- [Rust](https://rustup.rs/) (stable)
- [Bun](https://bun.sh/)

## Getting Started

```bash
# Install Tauri CLI
cargo install tauri-cli --version "^2"

# Install frontend dependencies
bun install

# Run in development (HMR for frontend, auto-rebuild for Rust)
bun run tauri:dev
```

## Build

```bash
# Production .app bundle + DMG
bun run tauri:build
```

Output:
- `src-tauri/target/release/bundle/macos/Disk Doctor.app`
- `src-tauri/target/release/bundle/dmg/Disk Doctor_0.1.0_aarch64.dmg`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Rust, Tauri v2, walkdir, rayon, rusqlite, trash crate |
| Frontend | React 19, TypeScript, Tailwind CSS v4, Zustand, @tanstack/react-virtual |
| Icons | Lucide React |
| Bundler | Vite |
| Package Manager | Bun |

## Architecture

```
┌─────────────────────────────────────────────────┐
│  React Frontend (Vite + Tailwind)               │
│  ┌───────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ FileList   │ │ Toolbar  │ │ DetailPanel    │  │
│  │ (virtual)  │ │          │ │                │  │
│  └─────┬─────┘ └────┬─────┘ └───────┬────────┘  │
│        │             │               │           │
│        └─────────────┴───────────────┘           │
│                      │ Tauri IPC                 │
├──────────────────────┼───────────────────────────┤
│  Rust Backend        │                           │
│  ┌───────────────────▼──────────────────────┐    │
│  │ Commands (get_children, scan_directory,  │    │
│  │           trash_items, get_disk_usage)   │    │
│  └───────────────────┬──────────────────────┘    │
│  ┌───────────────────▼────┐  ┌───────────────┐   │
│  │ Scanner (rayon parallel│  │ SQLite (WAL)  │   │
│  │   walkdir + emitter)   │──│ scan history  │   │
│  └────────────────────────┘  └───────────────┘   │
└─────────────────────────────────────────────────┘
```

**Key design decision:** Rust owns the data. The frontend never holds the full file tree — it requests shallow children for the current view via IPC. This keeps memory usage flat regardless of scan size.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Navigate items |
| `←` / `Backspace` | Go back |
| `Cmd+A` | Select all |
| `Shift+Click` | Range select |
| `Cmd+Backspace` | Trash selected |
| `Cmd+F` | Focus search filter |
| `?` | Show shortcut overlay |
| `Escape` | Deselect all |

## License

MIT
