use std::io::ErrorKind;
use std::process::{Command, Stdio};
use std::sync::mpsc::channel;
use std::time::Duration;

/// Output returned from executing a command via `wsl.exe`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WslCommandOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub success: bool,
}

/// Errors that can occur when executing WSL commands.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WslExecutionError {
    WslNotInstalled,
    Timeout {
        distro: Option<String>,
        command: String,
        elapsed_ms: u64,
    },
    CommandFailed {
        distro: Option<String>,
        command: String,
        message: String,
    },
    IoError(String),
}

impl std::fmt::Display for WslExecutionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WslExecutionError::WslNotInstalled => {
                write!(f, "WSL is not installed or wsl.exe is unavailable on this host")
            }
            WslExecutionError::Timeout {
                distro,
                command,
                elapsed_ms,
            } => {
                if let Some(d) = distro {
                    write!(
                        f,
                        "WSL command '{}' timed out after {}ms in distribution '{}'",
                        command, elapsed_ms, d
                    )
                } else {
                    write!(
                        f,
                        "WSL command '{}' timed out after {}ms",
                        command, elapsed_ms
                    )
                }
            }
            WslExecutionError::CommandFailed {
                distro,
                command,
                message,
            } => {
                if let Some(d) = distro {
                    write!(
                        f,
                        "WSL command '{}' failed in distribution '{}': {}",
                        command, d, message
                    )
                } else {
                    write!(f, "WSL command '{}' failed: {}", command, message)
                }
            }
            WslExecutionError::IoError(msg) => write!(f, "WSL I/O error: {}", msg),
        }
    }
}

impl std::error::Error for WslExecutionError {}

/// Trait defining the WSL command execution abstraction.
pub trait WslExecutor: Send + Sync {
    /// Executes a command inside a specific WSL distribution with a bounded timeout.
    fn execute(
        &self,
        distro: &str,
        command: &str,
        args: &[&str],
        timeout_ms: u64,
    ) -> Result<WslCommandOutput, WslExecutionError>;

    /// Executes `wsl.exe` directly on the Windows host with given arguments (e.g. `["--list", "--verbose"]`).
    fn execute_host(
        &self,
        args: &[&str],
        timeout_ms: u64,
    ) -> Result<WslCommandOutput, WslExecutionError>;
}

/// Default implementation of `WslExecutor` using `std::process::Command`.
pub struct DefaultWslExecutor;

impl DefaultWslExecutor {
    pub fn new() -> Self {
        Self
    }
}

impl Default for DefaultWslExecutor {
    fn default() -> Self {
        Self::new()
    }
}

impl WslExecutor for DefaultWslExecutor {
    fn execute(
        &self,
        distro: &str,
        command: &str,
        args: &[&str],
        timeout_ms: u64,
    ) -> Result<WslCommandOutput, WslExecutionError> {
        // Build argument vector: ["-d", distro, "--", command, arg1, arg2, ...]
        let mut full_args = Vec::with_capacity(3 + args.len());
        full_args.push("-d");
        full_args.push(distro);
        full_args.push("--");
        full_args.push(command);
        full_args.extend_from_slice(args);

        run_command_with_timeout("wsl.exe", &full_args, Some(distro.to_string()), command.to_string(), timeout_ms)
    }

    fn execute_host(
        &self,
        args: &[&str],
        timeout_ms: u64,
    ) -> Result<WslCommandOutput, WslExecutionError> {
        run_command_with_timeout("wsl.exe", args, None, "wsl.exe".to_string(), timeout_ms)
    }
}

/// Helper function to safely spawn a process and enforce a bounded timeout.
fn run_command_with_timeout(
    program: &str,
    args: &[&str],
    distro: Option<String>,
    cmd_name: String,
    timeout_ms: u64,
) -> Result<WslCommandOutput, WslExecutionError> {
    let mut command = Command::new(program);
    command.args(args);
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    // On Windows, hide command window
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let (sender, receiver) = channel();

    let child = match command.spawn() {
        Ok(c) => c,
        Err(err) => {
            if err.kind() == ErrorKind::NotFound {
                return Err(WslExecutionError::WslNotInstalled);
            }
            return Err(WslExecutionError::IoError(format!(
                "Failed to spawn {}: {}",
                program, err
            )));
        }
    };

    let child_handle = std::thread::spawn(move || {
        let output_res = child.wait_with_output();
        let _ = sender.send(output_res);
    });

    let timeout_duration = Duration::from_millis(timeout_ms);
    match receiver.recv_timeout(timeout_duration) {
        Ok(Ok(output)) => {
            let _ = child_handle.join();
            let stdout_str = decode_utf16_or_utf8(&output.stdout);
            let stderr_str = decode_utf16_or_utf8(&output.stderr);
            let exit_code = output.status.code().unwrap_or(-1);

            Ok(WslCommandOutput {
                stdout: stdout_str,
                stderr: stderr_str,
                exit_code,
                success: output.status.success(),
            })
        }
        Ok(Err(io_err)) => Err(WslExecutionError::IoError(format!(
            "Failed waiting for process: {}",
            io_err
        ))),
        Err(_) => {
            // Timed out: return Timeout error
            Err(WslExecutionError::Timeout {
                distro,
                command: cmd_name,
                elapsed_ms: timeout_ms,
            })
        }
    }
}

/// Decodes binary byte output from Windows `wsl.exe` or Linux standard outputs.
/// Handles:
/// 1. UTF-16LE with BOM (`0xFF, 0xFE`)
/// 2. UTF-16LE without BOM (null bytes on alternate indices)
/// 3. UTF-8 fallback
pub fn decode_utf16_or_utf8(bytes: &[u8]) -> String {
    if bytes.is_empty() {
        return String::new();
    }

    // 1. Check for UTF-16LE BOM [0xFF, 0xFE]
    if bytes.len() >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE {
        let u16_slice: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
            .collect();
        return String::from_utf16_lossy(&u16_slice);
    }

    // 2. Check if output is UTF-16LE without BOM (e.g. wsl.exe -l -v on Windows)
    if bytes.len() >= 4 && (bytes[1] == 0 || bytes[3] == 0) {
        let u16_slice: Vec<u16> = bytes
            .chunks_exact(2)
            .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
            .collect();
        let decoded = String::from_utf16_lossy(&u16_slice);
        // Ensure result isn't purely corrupted nulls
        if !decoded.trim().is_empty() {
            return decoded;
        }
    }

    // 3. Fallback to standard UTF-8 lossy conversion
    String::from_utf8_lossy(bytes).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_utf8_ascii() {
        let bytes = b"LISTEN 0 128 0.0.0.0:3000";
        let decoded = decode_utf16_or_utf8(bytes);
        assert_eq!(decoded, "LISTEN 0 128 0.0.0.0:3000");
    }

    #[test]
    fn test_decode_utf16le_with_bom() {
        // UTF-16LE for "Ubuntu\n" with BOM
        let mut bytes = vec![0xFF, 0xFE];
        for c in "Ubuntu\n".encode_utf16() {
            bytes.extend_from_slice(&c.to_le_bytes());
        }

        let decoded = decode_utf16_or_utf8(&bytes);
        assert_eq!(decoded, "Ubuntu\n");
    }

    #[test]
    fn test_decode_utf16le_without_bom() {
        // UTF-16LE for "NAME STATE VERSION" without BOM
        let mut bytes = Vec::new();
        for c in "NAME STATE VERSION".encode_utf16() {
            bytes.extend_from_slice(&c.to_le_bytes());
        }

        let decoded = decode_utf16_or_utf8(&bytes);
        assert_eq!(decoded, "NAME STATE VERSION");
    }

    #[test]
    fn test_decode_empty_bytes() {
        let decoded = decode_utf16_or_utf8(&[]);
        assert_eq!(decoded, "");
    }
}
