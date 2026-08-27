use crate::models::log::{
    LogEntry, LogSessionStatus, LogSessionView, LogSource, LogStream, LogUpdateEvent,
};
use chrono::Local;
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

/// Default maximum number of lines retained per service log session buffer.
pub const DEFAULT_MAX_LOG_ENTRIES: usize = 5000;

/// Callback listener type for streaming live log updates.
pub type LogListener = Arc<dyn Fn(LogUpdateEvent) + Send + Sync + 'static>;

/// In-memory transient log session for a single running or recently executed server profile.
#[derive(Debug, Clone)]
pub struct LogSession {
    pub session_id: String,
    pub profile_id: String,
    pub status: LogSessionStatus,
    pub source: LogSource,
    pub started_at: String,
    pub entries: VecDeque<LogEntry>,
    pub stdout_partial: String,
    pub stderr_partial: String,
    pub next_entry_index: usize,
}

impl LogSession {
    pub fn new(profile_id: impl Into<String>, source: LogSource) -> Self {
        let now = Local::now().to_rfc3339();
        Self {
            session_id: Uuid::new_v4().to_string(),
            profile_id: profile_id.into(),
            status: LogSessionStatus::Running,
            source,
            started_at: now,
            entries: VecDeque::with_capacity(512),
            stdout_partial: String::new(),
            stderr_partial: String::new(),
            next_entry_index: 1,
        }
    }
}

/// Central application log manager coordinating transient process output capture,
/// bounded ring buffers, ANSI escape sanitization, and live event streaming.
pub struct LogManager {
    sessions: Arc<Mutex<HashMap<String, LogSession>>>,
    listener: Arc<Mutex<Option<LogListener>>>,
    max_lines: usize,
}

impl Default for LogManager {
    fn default() -> Self {
        Self::new()
    }
}

impl LogManager {
    /// Creates a new `LogManager` with the default bounded line limit (5,000 lines).
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            listener: Arc::new(Mutex::new(None)),
            max_lines: DEFAULT_MAX_LOG_ENTRIES,
        }
    }

    /// Creates a `LogManager` with a custom line buffer limit (useful for tests).
    pub fn with_max_lines(max_lines: usize) -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            listener: Arc::new(Mutex::new(None)),
            max_lines,
        }
    }

    /// Registers a listener callback invoked whenever new log entries are appended or session status changes.
    pub fn set_listener<F>(&self, callback: F)
    where
        F: Fn(LogUpdateEvent) + Send + Sync + 'static,
    {
        if let Ok(mut guard) = self.listener.lock() {
            *guard = Some(Arc::new(callback));
        }
    }

    /// Clears any registered event listener.
    pub fn clear_listener(&self) {
        if let Ok(mut guard) = self.listener.lock() {
            *guard = None;
        }
    }

    fn notify_listener(&self, event: LogUpdateEvent) {
        if let Ok(guard) = self.listener.lock() {
            if let Some(cb) = guard.as_ref() {
                cb(event);
            }
        }
    }

    /// Creates or resets a transient log session for a server profile.
    /// Replaces any existing session for `profile_id`, ensuring fresh process runs do not mix logs.
    pub fn create_session(&self, profile_id: &str, source: LogSource) -> String {
        let session = LogSession::new(profile_id, source);
        let session_id = session.session_id.clone();

        if let Ok(mut map) = self.sessions.lock() {
            map.insert(profile_id.to_string(), session);
        }

        session_id
    }

    /// Strips ANSI escape sequences (CSI, OSC, 2-character sequences) from raw terminal output.
    pub fn strip_ansi(input: &str) -> String {
        let mut result = String::with_capacity(input.len());
        let mut chars = input.chars().peekable();

        while let Some(ch) = chars.next() {
            if ch == '\x1B' {
                // Check next character
                if let Some(&next_ch) = chars.peek() {
                    match next_ch {
                        '[' => {
                            // CSI sequence: ESC [ ... [command character @-~]
                            chars.next(); // consume '['
                            while let Some(&c) = chars.peek() {
                                chars.next();
                                if ('@'..='~').contains(&c) {
                                    break;
                                }
                            }
                        }
                        ']' => {
                            // OSC sequence: ESC ] ... (BEL or ESC \)
                            chars.next(); // consume ']'
                            while let Some(&c) = chars.peek() {
                                chars.next();
                                if c == '\x07' {
                                    break;
                                }
                                if c == '\x1B' {
                                    if let Some(&slash) = chars.peek() {
                                        if slash == '\\' {
                                            chars.next();
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        '(' | ')' | '*' | '+' | '-' | '.' | '/' => {
                            // Character set selection: ESC ( X
                            chars.next();
                            chars.next();
                        }
                        _ => {
                            // Simple 2-character escape sequence: ESC <char>
                            chars.next();
                        }
                    }
                }
            } else if ch == '\r' {
                // Normalize carriage returns: skip standalone \r (it will be handled by line splitting)
                continue;
            } else {
                result.push(ch);
            }
        }

        result
    }

    /// Ingests an arbitrary process output chunk, normalizes line boundaries, strips ANSI,
    /// appends to the bounded session buffer, and invokes the listener if new lines were produced.
    pub fn append_chunk(
        &self,
        profile_id: &str,
        session_id: &str,
        stream: LogStream,
        chunk: &str,
    ) {
        if chunk.is_empty() {
            return;
        }

        let mut new_entries = Vec::new();
        let current_status;

        {
            let mut map = match self.sessions.lock() {
                Ok(guard) => guard,
                Err(_) => return,
            };

            let session = match map.get_mut(profile_id) {
                Some(s) if s.session_id == session_id => s,
                _ => return, // Ignore chunks from stale/abandoned sessions
            };

            current_status = session.status;

            // Select active partial buffer
            let partial = match stream {
                LogStream::Stdout => &mut session.stdout_partial,
                LogStream::Stderr => &mut session.stderr_partial,
            };

            // Combine partial buffer with incoming chunk
            partial.push_str(chunk);

            // Normalize CRLF to LF
            let combined = partial.replace("\r\n", "\n");

            // Split into lines
            let mut parts: Vec<&str> = combined.split('\n').collect();

            // The last part is incomplete (trailing after last \n), save it back to partial
            let trailing = parts.pop().unwrap_or("");
            *partial = trailing.to_string();

            // Process each complete line
            for raw_line in parts {
                let cleaned_text = Self::strip_ansi(raw_line);
                let timestamp = Local::now().format("%H:%M:%S").to_string();
                let entry_id = format!("{}-{}", session.session_id, session.next_entry_index);
                session.next_entry_index += 1;

                let entry = LogEntry {
                    id: entry_id,
                    timestamp,
                    stream,
                    text: cleaned_text,
                };

                // Ring buffer: discard oldest when limit reached
                if session.entries.len() >= self.max_lines {
                    session.entries.pop_front();
                }

                session.entries.push_back(entry.clone());
                new_entries.push(entry);
            }
        }

        // Notify listener if new lines arrived
        if !new_entries.is_empty() {
            self.notify_listener(LogUpdateEvent {
                profile_id: profile_id.to_string(),
                session_id: session_id.to_string(),
                status: current_status,
                new_entries,
            });
        }
    }

    /// Flushes any remaining partial buffer text upon EOF (process exit or pipe close).
    pub fn flush_partials(
        &self,
        profile_id: &str,
        session_id: &str,
        stream: LogStream,
    ) {
        let mut new_entries = Vec::new();
        let current_status;

        {
            let mut map = match self.sessions.lock() {
                Ok(guard) => guard,
                Err(_) => return,
            };

            let session = match map.get_mut(profile_id) {
                Some(s) if s.session_id == session_id => s,
                _ => return,
            };

            current_status = session.status;

            let partial = match stream {
                LogStream::Stdout => &mut session.stdout_partial,
                LogStream::Stderr => &mut session.stderr_partial,
            };

            if !partial.is_empty() {
                let raw_line = std::mem::take(partial);
                let cleaned_text = Self::strip_ansi(&raw_line);
                if !cleaned_text.is_empty() {
                    let timestamp = Local::now().format("%H:%M:%S").to_string();
                    let entry_id = format!("{}-{}", session.session_id, session.next_entry_index);
                    session.next_entry_index += 1;

                    let entry = LogEntry {
                        id: entry_id,
                        timestamp,
                        stream,
                        text: cleaned_text,
                    };

                    if session.entries.len() >= self.max_lines {
                        session.entries.pop_front();
                    }

                    session.entries.push_back(entry.clone());
                    new_entries.push(entry);
                }
            }
        }

        if !new_entries.is_empty() {
            self.notify_listener(LogUpdateEvent {
                profile_id: profile_id.to_string(),
                session_id: session_id.to_string(),
                status: current_status,
                new_entries,
            });
        }
    }

    /// Updates the execution status of an active session (e.g. mark Stopped upon child exit).
    pub fn mark_status(
        &self,
        profile_id: &str,
        session_id: &str,
        status: LogSessionStatus,
    ) {
        let updated = if let Ok(mut map) = self.sessions.lock() {
            if let Some(session) = map.get_mut(profile_id) {
                if session.session_id == session_id {
                    session.status = status;
                    true
                } else {
                    false
                }
            } else {
                false
            }
        } else {
            false
        };

        if updated {
            self.notify_listener(LogUpdateEvent {
                profile_id: profile_id.to_string(),
                session_id: session_id.to_string(),
                status,
                new_entries: Vec::new(),
            });
        }
    }

    /// Retrieves an enriched snapshot view of a server profile's current log session.
    pub fn get_session_view(
        &self,
        profile_id: &str,
        is_profile_running: bool,
        is_runara_started: bool,
    ) -> LogSessionView {
        let map = self.sessions.lock().unwrap_or_else(|e| e.into_inner());

        if let Some(session) = map.get(profile_id) {
            let entries: Vec<LogEntry> = session.entries.iter().cloned().collect();
            LogSessionView {
                session_id: session.session_id.clone(),
                profile_id: session.profile_id.clone(),
                status: session.status,
                source: session.source,
                is_live_available: true,
                unavailable_reason: None,
                started_at: session.started_at.clone(),
                total_lines: entries.len(),
                entries,
            }
        } else {
            // No session in memory
            let now = Local::now().to_rfc3339();
            if is_profile_running {
                if is_runara_started {
                    // Running but session missing (e.g. after Runara restarted while process survived)
                    LogSessionView {
                        session_id: String::new(),
                        profile_id: profile_id.to_string(),
                        status: LogSessionStatus::Running,
                        source: LogSource::External,
                        is_live_available: false,
                        unavailable_reason: Some(
                            "Live log output unavailable for this running process. Runara was not attached when this process started."
                                .to_string(),
                        ),
                        started_at: now,
                        total_lines: 0,
                        entries: Vec::new(),
                    }
                } else {
                    // Unmanaged / externally adopted service
                    LogSessionView {
                        session_id: String::new(),
                        profile_id: profile_id.to_string(),
                        status: LogSessionStatus::Running,
                        source: LogSource::External,
                        is_live_available: false,
                        unavailable_reason: Some(
                            "Live log output unavailable. Runara did not start this service.".to_string(),
                        ),
                        started_at: now,
                        total_lines: 0,
                        entries: Vec::new(),
                    }
                }
            } else {
                // Stopped and never started in this application run
                LogSessionView {
                    session_id: String::new(),
                    profile_id: profile_id.to_string(),
                    status: LogSessionStatus::Stopped,
                    source: LogSource::Runara,
                    is_live_available: false,
                    unavailable_reason: Some("No log output available for this service.".to_string()),
                    started_at: now,
                    total_lines: 0,
                    entries: Vec::new(),
                }
            }
        }
    }

    /// Clears the currently displayed log buffer for a service session without modifying process or database state.
    pub fn clear_session(&self, profile_id: &str) -> bool {
        if let Ok(mut map) = self.sessions.lock() {
            if let Some(session) = map.get_mut(profile_id) {
                session.entries.clear();
                return true;
            }
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ansi_stripping() {
        let raw = "\x1B[32mServer started on port 5000\x1B[0m\x1B[2K";
        let cleaned = LogManager::strip_ansi(raw);
        assert_eq!(cleaned, "Server started on port 5000");

        let raw_osc = "\x1B]0;My Terminal Window\x07Hello World";
        let cleaned_osc = LogManager::strip_ansi(raw_osc);
        assert_eq!(cleaned_osc, "Hello World");
    }

    #[test]
    fn test_chunk_normalization_and_line_buffering() {
        let manager = LogManager::with_max_lines(100);
        let profile_id = "prof-test";
        let session_id = manager.create_session(profile_id, LogSource::Runara);

        // Chunk 1: Incomplete line
        manager.append_chunk(profile_id, &session_id, LogStream::Stdout, "Server is ");
        let view = manager.get_session_view(profile_id, true, true);
        assert_eq!(view.entries.len(), 0);

        // Chunk 2: Line completion + another line
        manager.append_chunk(
            profile_id,
            &session_id,
            LogStream::Stdout,
            "starting...\nConnected to DB\n",
        );
        let view = manager.get_session_view(profile_id, true, true);
        assert_eq!(view.entries.len(), 2);
        assert_eq!(view.entries[0].text, "Server is starting...");
        assert_eq!(view.entries[0].stream, LogStream::Stdout);
        assert_eq!(view.entries[1].text, "Connected to DB");

        // Chunk 3: Stderr stream chunk
        manager.append_chunk(
            profile_id,
            &session_id,
            LogStream::Stderr,
            "Warning: dev mode\n",
        );
        let view = manager.get_session_view(profile_id, true, true);
        assert_eq!(view.entries.len(), 3);
        assert_eq!(view.entries[2].text, "Warning: dev mode");
        assert_eq!(view.entries[2].stream, LogStream::Stderr);

        // Chunk 4: Incomplete line flushed on EOF
        manager.append_chunk(profile_id, &session_id, LogStream::Stdout, "Final exit message");
        manager.flush_partials(profile_id, &session_id, LogStream::Stdout);
        let view = manager.get_session_view(profile_id, true, true);
        assert_eq!(view.entries.len(), 4);
        assert_eq!(view.entries[3].text, "Final exit message");
    }

    #[test]
    fn test_bounded_ring_buffer_discards_old_entries() {
        let max_lines = 5;
        let manager = LogManager::with_max_lines(max_lines);
        let profile_id = "prof-noisy";
        let session_id = manager.create_session(profile_id, LogSource::Runara);

        for i in 1..=10 {
            manager.append_chunk(
                profile_id,
                &session_id,
                LogStream::Stdout,
                &format!("Line {}\n", i),
            );
        }

        let view = manager.get_session_view(profile_id, true, true);
        assert_eq!(view.entries.len(), 5);
        assert_eq!(view.entries[0].text, "Line 6");
        assert_eq!(view.entries[4].text, "Line 10");
    }

    #[test]
    fn test_session_lifecycle_reset() {
        let manager = LogManager::new();
        let profile_id = "prof-lifecycle";

        // Session 1
        let s1 = manager.create_session(profile_id, LogSource::Runara);
        manager.append_chunk(profile_id, &s1, LogStream::Stdout, "Run 1 output\n");
        let view1 = manager.get_session_view(profile_id, true, true);
        assert_eq!(view1.entries.len(), 1);
        assert_eq!(view1.entries[0].text, "Run 1 output");

        // Session 2 (restart creates fresh session)
        let s2 = manager.create_session(profile_id, LogSource::Runara);
        assert_ne!(s1, s2);
        let view2 = manager.get_session_view(profile_id, true, true);
        assert_eq!(view2.entries.len(), 0); // Fresh buffer

        // Old session chunks are rejected
        manager.append_chunk(profile_id, &s1, LogStream::Stdout, "Stale output\n");
        let view3 = manager.get_session_view(profile_id, true, true);
        assert_eq!(view3.entries.len(), 0);

        // New session accepts chunks
        manager.append_chunk(profile_id, &s2, LogStream::Stdout, "Run 2 output\n");
        let view4 = manager.get_session_view(profile_id, true, true);
        assert_eq!(view4.entries.len(), 1);
        assert_eq!(view4.entries[0].text, "Run 2 output");
    }

    #[test]
    fn test_clear_session_empties_buffer_without_destroying_session() {
        let manager = LogManager::new();
        let profile_id = "prof-clear";
        let s = manager.create_session(profile_id, LogSource::Runara);

        manager.append_chunk(profile_id, &s, LogStream::Stdout, "Line 1\nLine 2\n");
        assert_eq!(manager.get_session_view(profile_id, true, true).entries.len(), 2);

        // Clear
        assert!(manager.clear_session(profile_id));
        assert_eq!(manager.get_session_view(profile_id, true, true).entries.len(), 0);

        // Subsequent output continues to append
        manager.append_chunk(profile_id, &s, LogStream::Stdout, "Line 3\n");
        assert_eq!(manager.get_session_view(profile_id, true, true).entries.len(), 1);
        assert_eq!(manager.get_session_view(profile_id, true, true).entries[0].text, "Line 3");
    }

    #[test]
    fn test_unmanaged_service_returns_clear_diagnostic() {
        let manager = LogManager::new();
        let view = manager.get_session_view("unmanaged-prof", true, false);

        assert_eq!(view.is_live_available, false);
        assert_eq!(view.source, LogSource::External);
        assert!(view.unavailable_reason.unwrap().contains("Runara did not start this service"));
        assert_eq!(view.entries.len(), 0);
    }
}
