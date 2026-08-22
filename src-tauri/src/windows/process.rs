use std::ffi::c_void;

// Windows API Constants
pub const PROCESS_TERMINATE: u32 = 0x0001;
pub const PROCESS_QUERY_INFORMATION: u32 = 0x0400;
pub const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
pub const SYNCHRONIZE: u32 = 0x00100000;

pub const WAIT_OBJECT_0: u32 = 0x00000000;
pub const WAIT_TIMEOUT: u32 = 0x00000102; // 258
pub const WAIT_FAILED: u32 = 0xFFFFFFFF;

pub const ERROR_ACCESS_DENIED: u32 = 5;
pub const ERROR_INVALID_PARAMETER: u32 = 87;

#[link(name = "kernel32")]
extern "system" {
    fn OpenProcess(
        dwDesiredAccess: u32,
        bInheritHandle: i32,
        dwProcessId: u32,
    ) -> *mut c_void;

    fn TerminateProcess(
        hProcess: *mut c_void,
        uExitCode: u32,
    ) -> i32;

    fn WaitForSingleObject(
        hHandle: *mut c_void,
        dwMilliseconds: u32,
    ) -> u32;

    #[allow(dead_code)]
    fn GetExitCodeProcess(
        hProcess: *mut c_void,
        lpExitCode: *mut u32,
    ) -> i32;

    fn CloseHandle(
        hObject: *mut c_void,
    ) -> i32;

    fn GetLastError() -> u32;
}

/// Safe RAII wrapper around a Win32 process handle.
/// Guarantees that CloseHandle is invoked when dropped, preventing handle leaks.
#[derive(Debug)]
pub struct ProcessHandle {
    raw: *mut c_void,
    pid: u32,
}

// Win32 kernel handles can safely be transferred between threads
unsafe impl Send for ProcessHandle {}
unsafe impl Sync for ProcessHandle {}

impl ProcessHandle {
    /// Creates a new `ProcessHandle` managing the given raw handle pointer.
    pub fn new(raw: *mut c_void, pid: u32) -> Self {
        Self { raw, pid }
    }

    /// Returns the raw Win32 process handle pointer.
    pub fn raw(&self) -> *mut c_void {
        self.raw
    }

    /// Returns the PID associated with this handle.
    pub fn pid(&self) -> u32 {
        self.pid
    }
}

impl Drop for ProcessHandle {
    fn drop(&mut self) {
        if !self.raw.is_null() && self.raw != usize::MAX as *mut c_void {
            unsafe {
                CloseHandle(self.raw);
            }
        }
    }
}

/// Trait abstracting low-level OS process control operations.
/// Facilitates testing and future platform abstraction.
pub trait ProcessController: Send + Sync {
    /// Opens a native process handle with requested access permissions.
    fn open_process(&self, pid: u32, desired_access: u32) -> Result<ProcessHandle, u32>;

    /// Terminate a process via its handle.
    fn terminate_process(&self, handle: &ProcessHandle, exit_code: u32) -> Result<(), u32>;

    /// Waits up to `timeout_ms` for a process to exit.
    /// Returns `Ok(true)` if process exited, `Ok(false)` if timed out.
    fn wait_for_exit(&self, handle: &ProcessHandle, timeout_ms: u32) -> Result<bool, u32>;

    /// Returns whether a process with the given PID is actively running.
    fn is_process_alive(&self, pid: u32) -> bool;
}

/// Native Windows implementation of `ProcessController` using Win32 kernel32 APIs.
pub struct WindowsProcessController;

impl WindowsProcessController {
    pub fn new() -> Self {
        Self
    }
}

impl Default for WindowsProcessController {
    fn default() -> Self {
        Self::new()
    }
}

impl ProcessController for WindowsProcessController {
    fn open_process(&self, pid: u32, desired_access: u32) -> Result<ProcessHandle, u32> {
        let handle = unsafe { OpenProcess(desired_access, 0, pid) };
        if handle.is_null() {
            let err = unsafe { GetLastError() };
            Err(err)
        } else {
            Ok(ProcessHandle::new(handle, pid))
        }
    }

    fn terminate_process(&self, handle: &ProcessHandle, exit_code: u32) -> Result<(), u32> {
        let success = unsafe { TerminateProcess(handle.raw(), exit_code) };
        if success != 0 {
            Ok(())
        } else {
            let err = unsafe { GetLastError() };
            // If the process already exited while terminating, treat as success
            if err == ERROR_ACCESS_DENIED || err == ERROR_INVALID_PARAMETER {
                // Double-check if still alive
                let wait_res = unsafe { WaitForSingleObject(handle.raw(), 0) };
                if wait_res == WAIT_OBJECT_0 {
                    return Ok(());
                }
            }
            Err(err)
        }
    }

    fn wait_for_exit(&self, handle: &ProcessHandle, timeout_ms: u32) -> Result<bool, u32> {
        let res = unsafe { WaitForSingleObject(handle.raw(), timeout_ms) };
        match res {
            WAIT_OBJECT_0 => Ok(true),
            WAIT_TIMEOUT => Ok(false),
            _ => {
                let err = unsafe { GetLastError() };
                Err(err)
            }
        }
    }

    fn is_process_alive(&self, pid: u32) -> bool {
        // System and Idle processes are always considered running
        if pid == 0 || pid == 4 {
            return true;
        }

        // Attempt to open the process with SYNCHRONIZE and query access
        let handle = unsafe {
            OpenProcess(SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION, 0, pid)
        };

        if handle.is_null() {
            let err = unsafe { GetLastError() };
            // Access denied indicates the process exists and is alive under protected/admin credentials
            if err == ERROR_ACCESS_DENIED {
                return true;
            }
            // Invalid parameter (87) or not found means it does not exist
            return false;
        }

        let wait_res = unsafe { WaitForSingleObject(handle, 0) };
        unsafe { CloseHandle(handle) };

        // WAIT_TIMEOUT means the process object is unsignaled -> STILL RUNNING
        // WAIT_OBJECT_0 means signaled -> EXITED
        wait_res == WAIT_TIMEOUT
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    #[test]
    fn test_current_process_is_alive() {
        let controller = WindowsProcessController::new();
        let current_pid = std::process::id();
        assert!(
            controller.is_process_alive(current_pid),
            "Current process PID {} must be recognized as alive",
            current_pid
        );
    }

    #[test]
    fn test_non_existent_pid_is_not_alive() {
        let controller = WindowsProcessController::new();
        // A very high PID that should not exist
        assert!(
            !controller.is_process_alive(999_999_999),
            "Non-existent PID should not be alive"
        );
    }

    #[test]
    fn test_system_pids_reported_alive() {
        let controller = WindowsProcessController::new();
        assert!(controller.is_process_alive(0), "PID 0 (Idle) should be alive");
        assert!(controller.is_process_alive(4), "PID 4 (System) should be alive");
    }

    #[test]
    fn test_real_process_spawn_and_terminate() {
        let controller = WindowsProcessController::new();

        // Spawn a real child ping process that runs for 5 seconds
        let mut child = Command::new("cmd.exe")
            .args(["/c", "ping", "127.0.0.1", "-n", "6"])
            .spawn()
            .expect("Failed to spawn test child process");

        let child_pid = child.id();
        assert!(
            controller.is_process_alive(child_pid),
            "Spawned child process must be alive"
        );

        // Open handle with PROCESS_TERMINATE | SYNCHRONIZE
        let handle_res = controller.open_process(
            child_pid,
            PROCESS_TERMINATE | SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION,
        );
        assert!(handle_res.is_ok(), "Opening child process handle should succeed");
        let handle = handle_res.unwrap();

        // Terminate the process
        let term_res = controller.terminate_process(&handle, 1);
        assert!(term_res.is_ok(), "Terminating process should succeed");

        // Wait for exit with 2000ms bounded timeout
        let exited = controller.wait_for_exit(&handle, 2000).expect("Wait failed");
        assert!(exited, "Process should have exited after termination");

        // Drop the handle
        drop(handle);

        // Reap the child handle via stdlib
        let _ = child.wait();

        // Verify it is no longer alive
        assert!(
            !controller.is_process_alive(child_pid),
            "Terminated process should not be alive"
        );
    }
}
