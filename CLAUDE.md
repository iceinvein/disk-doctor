# Disk Doctor

macOS disk analyzer built with Tauri v2 (Rust backend + React frontend).

## Tech Stack
- **Backend**: Rust (Tauri v2, walkdir, rayon, trash crate)
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Zustand, @tanstack/react-virtual
- **Icons**: Lucide React
- **Package manager**: Bun

## Commands
- `bun run tauri:dev` — development with HMR
- `bun run tauri:build` — production .app bundle

## Architecture
- Rust owns the scan tree in managed state. Frontend fetches per-view via `get_children(path)`.
- Scanning: parallel walkdir (rayon), shared flat entries, emitter thread sends `view-update` events with shallow children at the current view path.
- Store: Zustand with fine-grained selectors. No full tree in JS memory.

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
