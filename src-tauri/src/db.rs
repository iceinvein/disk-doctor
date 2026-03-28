use crate::types::{DirEntry, ScanMeta};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::PathBuf;

pub fn db_path() -> PathBuf {
    let mut path = dirs::data_dir().expect("Could not find Application Support directory");
    path.push("Disk Doctor");
    std::fs::create_dir_all(&path).ok();
    path.push("disk-doctor.db");
    path
}

pub fn init_db(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            root_path TEXT NOT NULL,
            root_name TEXT NOT NULL,
            scanned_at INTEGER NOT NULL,
            scan_time REAL,
            total_size INTEGER DEFAULT 0,
            total_items INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS entries (
            scan_id INTEGER NOT NULL,
            path TEXT NOT NULL,
            parent_path TEXT NOT NULL,
            name TEXT NOT NULL,
            size INTEGER NOT NULL DEFAULT 0,
            is_dir INTEGER NOT NULL DEFAULT 0,
            child_count INTEGER NOT NULL DEFAULT 0,
            modified INTEGER NOT NULL DEFAULT 0,
            is_symlink INTEGER NOT NULL DEFAULT 0,
            is_restricted INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (scan_id, path)
        );

        CREATE INDEX IF NOT EXISTS idx_entries_parent ON entries(scan_id, parent_path);
    ",
    )?;
    Ok(())
}

/// Create a new scan record. Returns the scan_id.
pub fn create_scan(conn: &Connection, root_path: &str, root_name: &str) -> rusqlite::Result<i64> {
    let scanned_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    conn.execute(
        "INSERT INTO scans (root_path, root_name, scanned_at) VALUES (?1, ?2, ?3)",
        params![root_path, root_name, scanned_at],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Batch insert entries. Call this with chunks of entries during scan.
/// entries tuple: (path, parent_path, name, size, is_dir, child_count, modified, is_symlink, is_restricted)
pub fn insert_entries(
    conn: &Connection,
    scan_id: i64,
    entries: &[(String, String, String, u64, bool, u32, i64, bool, bool)],
) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    {
        let mut stmt = tx.prepare_cached(
            "INSERT OR REPLACE INTO entries (scan_id, path, parent_path, name, size, is_dir, child_count, modified, is_symlink, is_restricted) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        )?;
        for (path, parent_path, name, size, is_dir, child_count, modified, is_symlink, is_restricted) in
            entries
        {
            stmt.execute(params![
                scan_id,
                path,
                parent_path,
                name,
                size,
                *is_dir as i32,
                child_count,
                modified,
                *is_symlink as i32,
                *is_restricted as i32
            ])?;
        }
    }
    tx.commit()?;
    Ok(())
}

/// Update folder sizes bottom-up after scan completes.
/// This calculates the recursive size of each directory by summing its immediate children's sizes.
/// Because we process deepest directories first, child directories already have their correct sizes
/// by the time we process their parents.
pub fn compute_folder_sizes(conn: &Connection, scan_id: i64) -> rusqlite::Result<()> {
    // Get all directories sorted by path length desc (deepest first)
    let mut stmt = conn.prepare(
        "SELECT path FROM entries WHERE scan_id = ?1 AND is_dir = 1 ORDER BY LENGTH(path) DESC",
    )?;
    let dir_paths: Vec<String> = stmt
        .query_map(params![scan_id], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();

    let tx = conn.unchecked_transaction()?;
    {
        let mut update_stmt = tx.prepare_cached(
            "UPDATE entries SET size = ?1, child_count = ?2 WHERE scan_id = ?3 AND path = ?4",
        )?;
        let mut sum_stmt = tx.prepare_cached(
            "SELECT COALESCE(SUM(size), 0), COUNT(*) FROM entries WHERE scan_id = ?1 AND parent_path = ?2",
        )?;

        for dir_path in &dir_paths {
            let (child_size, child_count): (i64, i64) = sum_stmt.query_row(
                params![scan_id, dir_path],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )?;
            update_stmt.execute(params![
                child_size,
                child_count as u32,
                scan_id,
                dir_path
            ])?;
        }
    }
    tx.commit()?;

    Ok(())
}

/// Complete a scan: set scan_time, total_size, total_items.
pub fn complete_scan(conn: &Connection, scan_id: i64, scan_time: f64) -> rusqlite::Result<()> {
    let total_items: i64 = conn.query_row(
        "SELECT COUNT(*) FROM entries WHERE scan_id = ?1",
        params![scan_id],
        |row| row.get(0),
    )?;

    // Get root entry size (which now includes recursive sizes after compute_folder_sizes)
    let root_size: i64 = conn
        .query_row(
            "SELECT size FROM entries WHERE scan_id = ?1 AND parent_path = ''",
            params![scan_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    conn.execute(
        "UPDATE scans SET scan_time = ?1, total_size = ?2, total_items = ?3 WHERE id = ?4",
        params![scan_time, root_size, total_items, scan_id],
    )?;
    Ok(())
}

/// Get children at a specific path for a scan.
pub fn get_children(
    conn: &Connection,
    scan_id: i64,
    parent_path: &str,
) -> rusqlite::Result<Vec<DirEntry>> {
    let mut stmt = conn.prepare_cached(
        "SELECT path, name, size, is_dir, child_count, modified, is_symlink, is_restricted FROM entries WHERE scan_id = ?1 AND parent_path = ?2 ORDER BY size DESC",
    )?;

    let entries = stmt
        .query_map(params![scan_id, parent_path], |row| {
            Ok(DirEntry {
                path: row.get(0)?,
                name: row.get(1)?,
                size: row.get::<_, i64>(2)? as u64,
                is_dir: row.get::<_, i32>(3)? != 0,
                child_count: row.get::<_, i32>(4)? as u32,
                modified: row.get(5)?,
                is_symlink: row.get::<_, i32>(6)? != 0,
                is_restricted: row.get::<_, i32>(7)? != 0,
                children: vec![],
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(entries)
}

/// Get a single entry by path.
pub fn get_entry(
    conn: &Connection,
    scan_id: i64,
    path: &str,
) -> rusqlite::Result<Option<DirEntry>> {
    conn.query_row(
        "SELECT path, name, size, is_dir, child_count, modified, is_symlink, is_restricted FROM entries WHERE scan_id = ?1 AND path = ?2",
        params![scan_id, path],
        |row| {
            Ok(DirEntry {
                path: row.get(0)?,
                name: row.get(1)?,
                size: row.get::<_, i64>(2)? as u64,
                is_dir: row.get::<_, i32>(3)? != 0,
                child_count: row.get::<_, i32>(4)? as u32,
                modified: row.get(5)?,
                is_symlink: row.get::<_, i32>(6)? != 0,
                is_restricted: row.get::<_, i32>(7)? != 0,
                children: vec![],
            })
        },
    )
    .optional()
}

/// Get the latest scan metadata.
pub fn get_latest_scan(conn: &Connection) -> rusqlite::Result<Option<ScanMeta>> {
    conn.query_row(
        "SELECT id, root_path, root_name, scanned_at, scan_time, total_size, total_items FROM scans ORDER BY scanned_at DESC LIMIT 1",
        [],
        |row| {
            Ok(ScanMeta {
                id: row.get(0)?,
                root_path: row.get(1)?,
                root_name: row.get(2)?,
                scanned_at: row.get(3)?,
                scan_time: row.get::<_, Option<f64>>(4)?.unwrap_or(0.0),
                total_size: row.get::<_, i64>(5)? as u64,
                total_items: row.get::<_, i64>(6)? as u32,
            })
        },
    )
    .optional()
}

/// List all scans.
pub fn list_scans(conn: &Connection) -> rusqlite::Result<Vec<ScanMeta>> {
    let mut stmt = conn.prepare(
        "SELECT id, root_path, root_name, scanned_at, scan_time, total_size, total_items FROM scans ORDER BY scanned_at DESC",
    )?;
    let scans = stmt
        .query_map([], |row| {
            Ok(ScanMeta {
                id: row.get(0)?,
                root_path: row.get(1)?,
                root_name: row.get(2)?,
                scanned_at: row.get(3)?,
                scan_time: row.get::<_, Option<f64>>(4)?.unwrap_or(0.0),
                total_size: row.get::<_, i64>(5)? as u64,
                total_items: row.get::<_, i64>(6)? as u32,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();
    Ok(scans)
}

/// Delete a scan and all its entries.
pub fn delete_scan(conn: &Connection, scan_id: i64) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM entries WHERE scan_id = ?1", params![scan_id])?;
    conn.execute("DELETE FROM scans WHERE id = ?1", params![scan_id])?;
    Ok(())
}

/// Delete an entry and all its descendants from the current scan (after trashing).
pub fn delete_entry(conn: &Connection, scan_id: i64, path: &str) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM entries WHERE scan_id = ?1 AND (path = ?2 OR path LIKE ?3)",
        params![scan_id, path, format!("{}/%", path)],
    )?;
    Ok(())
}
