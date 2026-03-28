# Disk Doctor

macOS disk analyzer built with Tauri v2 (Rust backend + React frontend).

## Prerequisites
```bash
cargo install tauri-cli --version "^2"  # Tauri CLI
bun install                              # Frontend deps
```

## Commands
```bash
bun run tauri:dev     # Dev with HMR (runs Vite + Cargo)
bun run tauri:build   # Production .app bundle
cargo build --manifest-path src-tauri/Cargo.toml  # Rust only
npx tsc --noEmit      # TypeScript check
```

## Tech Stack
- **Backend**: Rust (Tauri v2, walkdir, rayon, trash crate, libc)
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Zustand, @tanstack/react-virtual, Lucide React
- **Package manager**: Bun
- **Bundler**: Vite (required by Tauri — exception to CLAUDE.md Bun.serve() rule)

## File Structure
```
src-tauri/src/
  main.rs          — Tauri entry point
  lib.rs           — Plugin registration, managed state, command handler
  types.rs         — DirEntry, ViewUpdate, SavedScan, ScanProgress, DiskUsage
  scanner.rs       — Parallel walkdir, tree building, view-update emission
  commands.rs      — All Tauri IPC commands + ScanState

src/
  App.tsx           — Root layout, keyboard shortcuts, scan event listener
  main.tsx          — React mount
  state/
    store.ts        — Zustand store (viewEntries, breadcrumbs, scanning, etc.)
    types.ts        — TypeScript types mirroring Rust types
    helpers.ts      — sortEntries, formatSize, formatDate
  hooks/
    useTauri.ts     — useScanEvents, useScan, useNavigation, useTrash + standalone fns
  components/
    WelcomeScreen   — Landing with ring chart, scan buttons, resume last scan
    PermissionGuide — Full Disk Access step-by-step guide
    Titlebar        — Custom overlay titlebar (macOS traffic lights visible)
    Toolbar         — Back, breadcrumb, search filter, scan button
    FileList        — Virtualized list with context menu, search filtering
    FileRow         — Row with checkbox, icon, name (clickable for folders), bar, size, chevron
    DetailPanel     — Selected item metadata + trash/reveal actions
    StatusBar       — Item count or scan progress + batch trash
    DiskUsageBar    — Total/used/free disk bar with legend
    ContextMenu     — Right-click: Open, Trash, Reveal, Copy Path
    ConfirmDialog   — Reusable confirmation modal with focus trap
    ShortcutOverlay — "?" keyboard shortcut reference
  styles/
    index.css       — Tailwind + CSS variables + animations + prefers-reduced-motion
```

## IPC Contract (Rust ↔ Frontend)

### Tauri Commands (invoke)
| Command | Purpose |
|---------|---------|
| `pick_folder` | Native macOS folder picker |
| `scan_directory(path)` | Parallel scan, emits events, returns final tree |
| `cancel_scan` | Sets cancelled flag |
| `set_view_path(path)` | Tells Rust which folder the frontend is viewing |
| `get_children(path)` | Returns shallow children at path from stored tree |
| `trash_items(paths)` | Move to macOS Trash |
| `open_in_finder(path)` | Reveal in Finder |
| `get_disk_usage(path)` | statvfs total/free/used |
| `check_full_disk_access` | Probe ~/Library/Mail |
| `open_full_disk_access_settings` | Deep-link to System Settings |
| `save_scan(rootPath, rootName, scanTime)` | Persist tree to ~/.disk-doctor/last-scan.json |
| `load_saved_scan` | Restore persisted scan + tree state |

### Tauri Events (listen)
| Event | Payload | When |
|-------|---------|------|
| `scan-progress` | `{ scanned_count, current_path }` | Every ~100ms during scan |
| `view-update` | `ViewUpdate` (shallow children at current view path) | Every 500ms-2s during scan |

## Key Patterns

- **Rust owns the tree**: Frontend never holds the full tree. Rust stores it in `ScanState.tree` (Arc<Mutex>). Frontend only gets shallow children for the current view via `get_children` or `view-update` events.
- **Zustand selectors**: Always use `useStore(s => s.field)` — never `useStore()`. Each component selects only what it renders.
- **View-based streaming**: During scan, a dedicated emitter thread periodically builds the tree from shared flat entries and emits `view-update` with only the children at the frontend's current `view_path`. Payloads are ~5KB, not 50MB.
- **Parallel scanning**: Top-level dirs scanned via rayon. Each walker flushes to shared `Vec<FlatEntry>` every 500 entries. Emitter thread is independent of walkers.
- **File type categories**: folder, media, audio, archive, code, document, system, other. Colors defined in CSS variables (--color-cat-*). Used in FileRow bars + icons.
- **Scan persistence**: Saved to `~/.disk-doctor/last-scan.json`. `load_saved_scan` restores both the tree into Rust state AND returns metadata to the frontend.

## Gotchas

- **Vite is required**: Tauri needs a dev server. This overrides the global CLAUDE.md rule about using Bun.serve().
- **titleBarStyle must be PascalCase**: `"Overlay"` not `"overlay"` in tauri.conf.json.
- **useScanEvents at App level**: Event listeners must live in a component that never unmounts. If placed in WelcomeScreen, events are lost when it unmounts during scan start.
- **RAF throttle on view-update**: Multiple events between frames → only the latest is applied via requestAnimationFrame.
- **Adaptive snapshot intervals**: <10K entries=500ms, 10K-100K=1s, >100K=2s. Prevents spending more time on tree-building than scanning.

## Design Context

### Users
Mac users who need to understand and reclaim disk space. Not exclusively developers — ranges from power users to non-technical users who just know their disk is full. Context: stressed, impatient, don't want to break things.

### Brand Personality
**Sharp, precise, powerful.** Respects the user's intelligence without being intimidating. Feels like a tool Apple would ship.

### Aesthetic Direction
**Native macOS utility.** Reference: Finder, Disk Utility, Activity Monitor.
- Theme: Follow system appearance (light + dark). Currently dark-only.
- Colors: macOS system blue (#0a84ff) accent, warm grays, file type category colors.
- Typography: SF Pro via -apple-system. No custom fonts.
- Icons: Lucide. Colored by file type category.
- Motion: Restrained. prefers-reduced-motion respected.
- Anti-references: CleanMyMac (too branded), DaisyDisk (too playful), neon/gradient aesthetics.

### Design Principles
1. **Native first**: Do what macOS does. System font, colors, conventions.
2. **Data as decoration**: Proportional bars and category colors ARE the visual design.
3. **Confidence through clarity**: Sizes, percentages, paths must be unambiguous. Trash is recoverable.
4. **Progressive depth**: Simple → detailed → power features, discovered naturally.
5. **Performance is a feature**: UI should never freeze. Instant feedback on every action.
