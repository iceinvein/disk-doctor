use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirEntry {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub is_dir: bool,
    pub child_count: u32,
    pub modified: i64,
    pub is_symlink: bool,
    pub is_restricted: bool,
    pub children: Vec<DirEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewUpdate {
    pub entries: Vec<DirEntry>,
    pub parent_path: String,
    pub parent_size: u64,
    pub parent_name: String,
    pub total_scanned: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgress {
    pub scanned_count: u32,
    pub current_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskUsage {
    pub total: u64,
    pub free: u64,
    pub used: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedScan {
    pub tree: DirEntry,
    pub root_path: String,
    pub root_name: String,
    pub scanned_at: i64,
    pub scan_time: f64,
}

/// Lightweight metadata sent to frontend (no tree — avoids serializing 100MB+)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedScanMeta {
    pub root_path: String,
    pub root_name: String,
    pub root_size: u64,
    pub scanned_at: i64,
    pub scan_time: f64,
}
