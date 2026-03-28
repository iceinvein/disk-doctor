# Disk Doctor — Design Spec

A distributable macOS disk analyzer built with Tauri (Rust backend + React frontend). Scans folders or entire disks, visualizes space usage with a hybrid file list + proportional bars layout, and supports batch deletion via macOS Trash.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Tauri Window                   │
│  ┌───────────────────────────────────────────┐   │
│  │         React Frontend (WebView)          │   │
│  │  ┌─────────────┐  ┌───────────────────┐   │   │
│  │  │  File List   │  │  Detail Panel     │   │   │
│  │  │  (sorted,    │  │  (info, actions,  │   │   │
│  │  │   filtered)  │  │   delete/trash)   │   │   │
│  │  └──────┬───────┘  └────────┬──────────┘   │   │
│  │         └────────┬───────────┘              │   │
│  └──────────────────┼────────────────────────┘   │
│                     │ Tauri invoke / listen       │
│  ┌──────────────────┼────────────────────────┐   │
│  │          Rust Backend (Commands)           │   │
│  │  scan_directory()  → streams DirEntry      │   │
│  │  get_entry_info()  → metadata              │   │
│  │  trash_items()     → macOS Trash           │   │
│  │  open_in_finder()  → NSWorkspace           │   │
│  │  request_full_disk_access() → Sys Prefs    │   │
│  └────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**Data flow:**

1. User picks a folder (native dialog) or clicks "Scan Entire Disk"
2. Rust scans using `walkdir` + `rayon`, streams progress events to frontend
3. On completion, full tree sent to frontend in one payload
4. Frontend holds tree in memory — navigation is instant, no further IPC
5. Trash/open operations invoke Rust commands with specific paths

## Target Platform

macOS only. Lean into native conventions: macOS Trash, Full Disk Access permission flow, `.app` bundle.

## Rust Backend

### Dependencies

- `walkdir` — recursive directory traversal
- `rayon` — parallel size computation
- `trash` — macOS-native Trash (`NSFileManager.trashItem`)
- `serde` — IPC serialization
- `tauri` — app framework

### Data Model

```rust
struct DirEntry {
    path: String,
    name: String,
    size: u64,           // bytes (sum of all children for folders)
    is_dir: bool,
    child_count: u32,    // immediate children (0 for files)
    modified: i64,       // unix timestamp
    children: Vec<DirEntry>,
}
```

### Commands

| Command | Purpose | Returns |
|---------|---------|---------|
| `pick_folder()` | Native macOS folder picker | `Option<String>` |
| `scan_directory(path)` | Walk tree, compute sizes, stream progress | Emits `scan-progress` events, returns full `DirEntry` tree |
| `trash_items(paths)` | Move to macOS Trash | `Result<Vec<String>, String>` (failed paths) |
| `open_in_finder(path)` | Reveal in Finder | `Result<(), String>` |
| `get_disk_usage()` | Total/free/used disk space | `{ total: u64, free: u64, used: u64 }` |

### Scanning Strategy

1. First pass: `walkdir` collects all entries with file sizes (single-threaded)
2. Second pass: bottom-up aggregation computes folder sizes by summing children
3. During scan: emit `scan-progress` events every ~100ms with `{ scanned_count: u32, current_path: String }`
4. On completion: send the full tree to frontend

### Permission Handling (Full Disk Access)

- Attempt to read a known protected path (e.g., `~/Library/Mail`)
- If permission denied: show dialog directing user to System Settings → Privacy & Security → Full Disk Access
- Cannot programmatically grant — user must do it manually

## React Frontend

### Component Tree

```
<App>
  ├── <Titlebar />              — Drag region, app name
  ├── <Toolbar />               — Scan button, "Scan Entire Disk", breadcrumb
  ├── <MainView>
  │   ├── <FileList />          — Scrollable virtualized list
  │   │   └── <FileRow />       — Checkbox, icon, name, bar, size
  │   └── <DetailPanel />       — Selected item info + actions
  │       ├── <ItemInfo />      — Icon, name, size, modified, % of parent
  │       └── <ItemActions />   — Trash, Open in Finder
  ├── <StatusBar />             — Item count, total size, scan time
  ├── <ScanModal />             — Progress overlay during scanning
  └── <WelcomeScreen />         — Landing when no scan active
```

### State (React Context + useReducer)

```typescript
type AppState = {
  tree: DirEntry | null
  currentPath: string[]          // breadcrumb segments into tree
  selectedPaths: Set<string>     // batch selection
  activePath: string | null      // detail panel target
  sortBy: 'size' | 'name' | 'modified'
  sortDir: 'asc' | 'desc'
  scanning: boolean
  scanProgress: { count: number, currentPath: string } | null
}
```

No external state library. `currentPath` walks the in-memory tree for navigation. Sorting is client-side.

### Styling

- Tailwind CSS
- Dark theme by default
- Proportional bars: `<div>` with width as percentage of largest sibling

### Key Interactions

| User Action | Result |
|-------------|--------|
| Click folder name | Push onto `currentPath`, show children |
| Click breadcrumb | Truncate `currentPath` to that level |
| Click row (not checkbox) | Set as active → detail panel updates |
| Toggle checkbox | Add/remove from `selectedPaths` |
| "Move to Trash" (detail panel) | `trash_items([path])`, remove from tree |
| "Trash Selected" (status bar) | `trash_items([...selectedPaths])`, remove all |
| "Open in Finder" | `open_in_finder(path)` |
| Back / keyboard ← | Pop `currentPath` |

## UX Flows

### Scan Flow

1. App launches → Welcome screen: "Choose Folder" + "Scan Entire Disk"
2. "Choose Folder" → native picker → scan begins
3. "Scan Entire Disk" → check Full Disk Access → instructions if denied → scan `/`
4. During scan → modal: spinner, file count, current path, cancel button
5. Complete → modal dismisses, list populates sorted by size desc

### Deletion Flow

1. **Single**: select → detail panel "Move to Trash" → confirmation dialog → execute → remove from tree, recalculate parent sizes
2. **Batch**: check multiple → status bar "N selected • X.X GB" + "Trash Selected" → confirmation listing items → execute → remove all, recalculate sizes
3. **Failure**: show error toast for specific failed file, skip it, continue with rest

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Symlinks | Don't follow. Show as files with link icon |
| Permission denied subfolder | Skip, show lock icon, size = 0 with "(restricted)" |
| Empty folders | Show at 0 B, sort to bottom |
| Deep nesting (1000+ levels) | `walkdir` handles; breadcrumb truncates with `...` after 5 segments |
| Huge directories (1M+ files) | Progressive streaming; virtual scroll (render ~50 visible rows) |
| Scan cancelled | Keep partial results |
| No scan active | Welcome/landing screen |

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| App framework | Tauri v2 |
| Backend | Rust |
| Frontend | React + TypeScript |
| Styling | Tailwind CSS |
| Bundler | Bun (for frontend tooling) |
| File traversal | `walkdir` + `rayon` |
| Trash | `trash` crate (macOS native) |
| Virtual scroll | `@tanstack/react-virtual` |
