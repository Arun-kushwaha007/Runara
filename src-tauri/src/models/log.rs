use serde::{Deserialize, Serialize};

/// Originating stream of a captured process log entry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogStream {
    Stdout,
    Stderr,
}

/// Source indicating whether the service was launched by Runara or externally adopted.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LogSource {
    Runara,
    External,
}

/// Lifecycle status of an in-memory log capture session.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogSessionStatus {
    Running,
    Stopped,
    Error,
}

/// Individual normalized log line with ingestion metadata.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    /// Unique identifier for this log entry within the session.
    pub id: String,
    /// Human-readable ingestion timestamp formatted as HH:MM:SS or RFC3339.
    pub timestamp: String,
    /// Process output stream (`stdout` or `stderr`).
    pub stream: LogStream,
    /// Normalized, ANSI-stripped display text.
    pub text: String,
}

/// Rich snapshot representation of a server profile's current log session returned to frontend.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogSessionView {
    /// Unique UUID of the transient log session.
    pub session_id: String,
    /// ID of the associated server profile.
    pub profile_id: String,
    /// Current execution state of the session.
    pub status: LogSessionStatus,
    /// Originating launch source (`runara` or `external`).
    pub source: LogSource,
    /// Whether live process stdout/stderr capture is available.
    pub is_live_available: bool,
    /// User-friendly explanation if live output is unavailable.
    pub unavailable_reason: Option<String>,
    /// RFC3339 timestamp when the session was created.
    pub started_at: String,
    /// Total number of active entries currently retained in the bounded buffer.
    pub total_lines: usize,
    /// Bounded slice of recent log entries.
    pub entries: Vec<LogEntry>,
}

/// Payload dispatched over Tauri event channel (`service-log-updated`) for real-time frontend streaming.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogUpdateEvent {
    pub profile_id: String,
    pub session_id: String,
    pub status: LogSessionStatus,
    pub new_entries: Vec<LogEntry>,
}
