import type { DirEntry, SortField, SortDir } from './types'

/**
 * Walk the tree by currentPath segments and return the children of the current folder.
 */
export function getCurrentEntries(
  tree: DirEntry | null,
  currentPath: string[],
): DirEntry[] {
  const node = getCurrentNode(tree, currentPath)
  return node?.children ?? []
}

/**
 * Walk the tree by currentPath segments and return the node itself.
 */
export function getCurrentNode(
  tree: DirEntry | null,
  currentPath: string[],
): DirEntry | null {
  if (!tree) return null

  let node = tree
  for (const segment of currentPath) {
    const child = node.children.find((c) => c.name === segment)
    if (!child) return null
    node = child
  }
  return node
}

/**
 * Recursively search the tree for an entry matching the given path string.
 */
export function findEntry(
  tree: DirEntry | null,
  path: string,
): DirEntry | null {
  if (!tree) return null
  if (tree.path === path) return tree

  for (const child of tree.children) {
    const found = findEntry(child, path)
    if (found) return found
  }
  return null
}

/**
 * Sort entries: directories first, then by the chosen field and direction.
 */
export function sortEntries(
  entries: DirEntry[],
  sortBy: SortField,
  sortDir: SortDir,
): DirEntry[] {
  const multiplier = sortDir === 'asc' ? 1 : -1

  return [...entries].sort((a, b) => {
    // Directories always come first
    if (a.is_dir && !b.is_dir) return -1
    if (!a.is_dir && b.is_dir) return 1

    switch (sortBy) {
      case 'size':
        return (a.size - b.size) * multiplier
      case 'name':
        return a.name.localeCompare(b.name) * multiplier
      case 'modified':
        return (a.modified - b.modified) * multiplier
      default:
        return 0
    }
  })
}

/**
 * Format bytes to a human-readable string (B, KB, MB, GB, TB).
 * Uses 1 decimal place for units larger than bytes.
 */
export function formatSize(bytes: number): string {
  if (bytes < 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let unitIndex = 0
  let size = bytes

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  if (unitIndex === 0) {
    return `${Math.round(size)} B`
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Format a unix timestamp (seconds) to a relative date string.
 * Shows "Today", "Yesterday", "N days ago" for recent dates,
 * or an absolute date for older entries.
 */
export function formatDate(timestamp: number): string {
  if (timestamp <= 0) return 'Unknown'

  const date = new Date(timestamp * 1000)
  const now = new Date()

  // Normalize to start of day for comparison
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const diffMs = startOfToday.getTime() - startOfDate.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays > 1 && diffDays <= 30) return `${diffDays} days ago`
  if (diffDays > 30 && diffDays <= 365) {
    const months = Math.round(diffDays / 30)
    return months === 1 ? '1 month ago' : `${months} months ago`
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Return a new tree with the specified paths removed.
 * Parent sizes are recalculated after removal.
 */
export function removePaths(
  tree: DirEntry,
  pathsToRemove: string[],
): DirEntry {
  const pathSet = new Set(pathsToRemove)

  function recurse(node: DirEntry): DirEntry {
    // Filter out children that are in the removal set
    const filteredChildren = node.children
      .filter((child) => !pathSet.has(child.path))
      .map((child) => recurse(child))

    // Recalculate size from remaining children
    const childrenSize = filteredChildren.reduce((sum, c) => sum + c.size, 0)

    return {
      ...node,
      children: filteredChildren,
      child_count: filteredChildren.length,
      // For directories, size is the sum of children.
      // For files (which won't have children removed), keep original size.
      size: node.is_dir ? childrenSize : node.size,
    }
  }

  return recurse(tree)
}
