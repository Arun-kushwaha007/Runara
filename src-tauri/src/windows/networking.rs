use crate::models::PortInfo;
use std::net::{Ipv4Addr, Ipv6Addr};

const AF_INET: u32 = 2;
const AF_INET6: u32 = 23;

const TCP_TABLE_OWNER_PID_ALL: i32 = 5;
const MIB_TCP_STATE_LISTEN: u32 = 2;
const ERROR_INSUFFICIENT_BUFFER: u32 = 122;
const NO_ERROR: u32 = 0;

#[repr(C)]
#[derive(Debug, Copy, Clone)]
struct MibTcpRowOwnerPid {
    dw_state: u32,
    dw_local_addr: u32,
    dw_local_port: u32,
    dw_remote_addr: u32,
    dw_remote_port: u32,
    dw_owning_pid: u32,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
struct MibTcp6RowOwnerPid {
    uc_local_addr: [u8; 16],
    dw_local_scope_id: u32,
    dw_local_port: u32,
    uc_remote_addr: [u8; 16],
    dw_remote_scope_id: u32,
    dw_remote_port: u32,
    dw_state: u32,
    dw_owning_pid: u32,
}

#[link(name = "iphlpapi")]
extern "system" {
    fn GetExtendedTcpTable(
        pTcpTable: *mut std::ffi::c_void,
        pdwSize: *mut u32,
        bOrder: i32,
        ulAf: u32,
        TableClass: i32,
        Reserved: u32,
    ) -> u32;
}

/// Enumerates all active listening TCP ports on Windows for both IPv4 and IPv6.
pub fn get_windows_listening_tcp_ports() -> Result<Vec<PortInfo>, String> {
    let mut ports = Vec::new();

    // Query IPv4 listening TCP sockets
    if let Ok(mut ipv4_ports) = get_ipv4_listening_ports() {
        ports.append(&mut ipv4_ports);
    } else {
        log_or_warn("Failed to query IPv4 extended TCP table");
    }

    // Query IPv6 listening TCP sockets
    if let Ok(mut ipv6_ports) = get_ipv6_listening_ports() {
        ports.append(&mut ipv6_ports);
    } else {
        log_or_warn("Failed to query IPv6 extended TCP table");
    }

    Ok(ports)
}

fn log_or_warn(msg: &str) {
    eprintln!("[DevHub PortDiscovery] {}", msg);
}

/// Queries IPv4 TCP listening sockets using Win32 GetExtendedTcpTable
fn get_ipv4_listening_ports() -> Result<Vec<PortInfo>, String> {
    let mut size = 0u32;
    let mut buffer: Vec<u8>;

    // Initial query to determine required buffer size
    unsafe {
        GetExtendedTcpTable(
            std::ptr::null_mut(),
            &mut size,
            0,
            AF_INET,
            TCP_TABLE_OWNER_PID_ALL,
            0,
        );
    }

    if size == 0 {
        return Ok(Vec::new());
    }

    // Allocate buffer with dynamic retry loop for concurrency safety
    let mut retries = 0;
    loop {
        buffer = vec![0u8; size as usize];
        let ret = unsafe {
            GetExtendedTcpTable(
                buffer.as_mut_ptr() as *mut std::ffi::c_void,
                &mut size,
                0,
                AF_INET,
                TCP_TABLE_OWNER_PID_ALL,
                0,
            )
        };

        if ret == NO_ERROR {
            break;
        } else if ret == ERROR_INSUFFICIENT_BUFFER && retries < 3 {
            retries += 1;
            continue;
        } else {
            return Err(format!("GetExtendedTcpTable (IPv4) returned error code: {}", ret));
        }
    }

    let mut result = Vec::new();

    if buffer.len() < std::mem::size_of::<u32>() {
        return Ok(result);
    }

    let num_entries = unsafe { *(buffer.as_ptr() as *const u32) };
    let row_size = std::mem::size_of::<MibTcpRowOwnerPid>();
    let expected_len = std::mem::size_of::<u32>() + (num_entries as usize * row_size);

    if buffer.len() < expected_len {
        return Ok(result);
    }

    let rows_ptr = unsafe {
        buffer.as_ptr().add(std::mem::size_of::<u32>()) as *const MibTcpRowOwnerPid
    };

    for i in 0..num_entries {
        let row = unsafe { *rows_ptr.add(i as usize) };
        if row.dw_state == MIB_TCP_STATE_LISTEN {
            let port = u16::from_be(row.dw_local_port as u16);
            let ip = Ipv4Addr::from(row.dw_local_addr.to_ne_bytes());

            result.push(PortInfo {
                port,
                pid: row.dw_owning_pid,
                protocol: "tcp".to_string(),
                address: ip.to_string(),
                state: "listening".to_string(),
                environment: crate::models::environment::Environment::windows(),
            });
        }
    }

    Ok(result)
}

/// Queries IPv6 TCP listening sockets using Win32 GetExtendedTcpTable
fn get_ipv6_listening_ports() -> Result<Vec<PortInfo>, String> {
    let mut size = 0u32;
    let mut buffer: Vec<u8>;

    // Initial query to determine required buffer size
    unsafe {
        GetExtendedTcpTable(
            std::ptr::null_mut(),
            &mut size,
            0,
            AF_INET6,
            TCP_TABLE_OWNER_PID_ALL,
            0,
        );
    }

    if size == 0 {
        return Ok(Vec::new());
    }

    // Allocate buffer with dynamic retry loop
    let mut retries = 0;
    loop {
        buffer = vec![0u8; size as usize];
        let ret = unsafe {
            GetExtendedTcpTable(
                buffer.as_mut_ptr() as *mut std::ffi::c_void,
                &mut size,
                0,
                AF_INET6,
                TCP_TABLE_OWNER_PID_ALL,
                0,
            )
        };

        if ret == NO_ERROR {
            break;
        } else if ret == ERROR_INSUFFICIENT_BUFFER && retries < 3 {
            retries += 1;
            continue;
        } else {
            return Err(format!("GetExtendedTcpTable (IPv6) returned error code: {}", ret));
        }
    }

    let mut result = Vec::new();

    if buffer.len() < std::mem::size_of::<u32>() {
        return Ok(result);
    }

    let num_entries = unsafe { *(buffer.as_ptr() as *const u32) };
    let row_size = std::mem::size_of::<MibTcp6RowOwnerPid>();
    let expected_len = std::mem::size_of::<u32>() + (num_entries as usize * row_size);

    if buffer.len() < expected_len {
        return Ok(result);
    }

    let rows_ptr = unsafe {
        buffer.as_ptr().add(std::mem::size_of::<u32>()) as *const MibTcp6RowOwnerPid
    };

    for i in 0..num_entries {
        let row = unsafe { *rows_ptr.add(i as usize) };
        if row.dw_state == MIB_TCP_STATE_LISTEN {
            let port = u16::from_be(row.dw_local_port as u16);
            let ip = Ipv6Addr::from(row.uc_local_addr);

            // Format IPv6 address enclosed in brackets for unambiguous URL/socket representations
            let formatted_address = format!("[{}]", ip);

            result.push(PortInfo {
                port,
                pid: row.dw_owning_pid,
                protocol: "tcp".to_string(),
                address: formatted_address,
                state: "listening".to_string(),
                environment: crate::models::environment::Environment::windows(),
            });
        }
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_windows_listening_tcp_ports() {
        let ports = get_windows_listening_tcp_ports().expect("Failed to get listening ports");
        // On any running Windows system, there are standard listening ports (RPC, NetBIOS, System, etc.)
        println!("Discovered {} listening TCP ports on Windows", ports.len());
        for p in ports.iter().take(5) {
            println!("  -> Port {} ({}) on PID {}", p.port, p.address, p.pid);
            assert_eq!(p.protocol, "tcp");
            assert_eq!(p.state, "listening");
            assert!(p.port > 0);
        }
    }

    #[test]
    fn test_network_byte_order_port_conversion() {
        // Port 3000 in hex is 0x0BB8
        // In network byte order (big endian), high byte is 0x0B (11), low byte is 0xB8 (184)
        // Stored in memory as little endian u32: 0x0000B80B (or 47115 in decimal)
        let raw_port_u32 = 0x0000B80B_u32;
        let converted = u16::from_be(raw_port_u32 as u16);
        assert_eq!(converted, 3000);

        // Port 80 in hex is 0x0050
        // In network order, high byte is 0x00, low byte is 0x50
        // Stored in memory as u32: 0x00005000 (or 20480 in decimal)
        let raw_port_80 = 0x00005000_u32;
        let converted_80 = u16::from_be(raw_port_80 as u16);
        assert_eq!(converted_80, 80);
    }
}
