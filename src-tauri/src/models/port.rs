use serde::{Deserialize, Serialize};

/// Represents a listening network port discovered on the system.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub struct PortInfo {
    /// Local listening port number (e.g., 3000, 8080).
    pub port: u16,
    /// Owning Process Identifier (PID) reported by the OS.
    pub pid: u32,
    /// Protocol name (e.g., "tcp").
    pub protocol: String,
    /// Local IP address bound to the socket (e.g., "127.0.0.1", "0.0.0.0", "[::1]", "[::]").
    pub address: String,
    /// Socket connection state (e.g., "listening").
    pub state: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_port_info_serialization_camel_case() {
        let info = PortInfo {
            port: 3000,
            pid: 18240,
            protocol: "tcp".to_string(),
            address: "127.0.0.1".to_string(),
            state: "listening".to_string(),
        };

        let json = serde_json::to_string(&info).expect("Failed to serialize");
        assert!(json.contains("\"port\":3000"));
        assert!(json.contains("\"pid\":18240"));
        assert!(json.contains("\"protocol\":\"tcp\""));
        assert!(json.contains("\"address\":\"127.0.0.1\""));
        assert!(json.contains("\"state\":\"listening\""));

        let deserialized: PortInfo = serde_json::from_str(&json).expect("Failed to deserialize");
        assert_eq!(deserialized, info);
    }

    #[test]
    fn test_port_info_ipv6_formatting() {
        let info = PortInfo {
            port: 5173,
            pid: 20412,
            protocol: "tcp".to_string(),
            address: "[::1]".to_string(),
            state: "listening".to_string(),
        };

        let json = serde_json::to_string(&info).expect("Failed to serialize");
        let deserialized: PortInfo = serde_json::from_str(&json).expect("Failed to deserialize");
        assert_eq!(deserialized.address, "[::1]");
        assert_eq!(deserialized.port, 5173);
    }

    #[test]
    fn test_multiple_ports_single_process() {
        let port1 = PortInfo {
            port: 3000,
            pid: 18240,
            protocol: "tcp".to_string(),
            address: "127.0.0.1".to_string(),
            state: "listening".to_string(),
        };

        let port2 = PortInfo {
            port: 3001,
            pid: 18240,
            protocol: "tcp".to_string(),
            address: "127.0.0.1".to_string(),
            state: "listening".to_string(),
        };

        let ports = vec![port1, port2];
        assert_eq!(ports.len(), 2);
        assert_eq!(ports[0].pid, ports[1].pid);
        assert_ne!(ports[0].port, ports[1].port);
    }

    #[test]
    fn test_wildcard_address_formatting() {
        let ipv4_wildcard = PortInfo {
            port: 8080,
            pid: 9999,
            protocol: "tcp".to_string(),
            address: "0.0.0.0".to_string(),
            state: "listening".to_string(),
        };

        let ipv6_wildcard = PortInfo {
            port: 8080,
            pid: 9999,
            protocol: "tcp".to_string(),
            address: "[::]".to_string(),
            state: "listening".to_string(),
        };

        assert_eq!(ipv4_wildcard.address, "0.0.0.0");
        assert_eq!(ipv6_wildcard.address, "[::]");
        assert_eq!(ipv4_wildcard.port, ipv6_wildcard.port);
    }
}
