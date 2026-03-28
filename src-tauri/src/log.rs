/// Centralised logging for Disk Doctor.
///
/// Usage:
///   log!(Scan, "starting parallel scan of: {}", root);
///   log!(Db,   "opened database at {:?}", path);
///   log!(Cmd,  "get_children({}) → {} entries", path, count);

#[derive(Debug, Clone, Copy)]
#[allow(dead_code)]
pub enum Category {
    Scan,
    Db,
    Cmd,
    Nav,
    Perf,
}

impl Category {
    pub fn tag(self) -> &'static str {
        match self {
            Category::Scan => "scan",
            Category::Db => "db",
            Category::Cmd => "cmd",
            Category::Nav => "nav",
            Category::Perf => "perf",
        }
    }
}

#[macro_export]
macro_rules! log {
    ($cat:ident, $($arg:tt)*) => {
        eprintln!("[{}] {}", $crate::log::Category::$cat.tag(), format!($($arg)*))
    };
}
