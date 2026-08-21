use crate::models::identity::{ProcessParentInfo, ProcessTreeNode};
use crate::models::process::ProcessInfo;
use std::collections::{HashMap, HashSet};

/// Maximum depth for traversing process ancestry to protect against
/// malformed OS metadata, deeply nested wrappers, or runaway structures.
pub const MAX_TREE_DEPTH: usize = 32;

/// Builder responsible for reconstructing process ancestry trees safely
/// with cycle detection and depth boundaries.
pub struct ProcessTreeBuilder;

impl ProcessTreeBuilder {
    /// Reconstructs the ancestry chain for a target process starting from the
    /// root ancestor down to the target process.
    ///
    /// # Safety Guarantees
    /// - **Cycle Protection**: Uses a `HashSet<u32>` visited set to detect and abort
    ///   if a cyclic parent-child loop exists (e.g. caused by PID reuse or corrupt OS tables).
    /// - **Depth Bound**: Stops after `MAX_TREE_DEPTH` (32) iterations.
    /// - **Self-Parent Protection**: Aborts if a process declares itself as its own parent.
    /// - **Missing Parent Handling**: Gracefully stops when a parent PID is no longer in the snapshot.
    pub fn build_tree(
        target: &ProcessInfo,
        process_map: &HashMap<u32, &ProcessInfo>,
    ) -> Vec<ProcessTreeNode> {
        let mut ancestry_chain: Vec<&ProcessInfo> = Vec::new();
        let mut visited: HashSet<u32> = HashSet::new();

        ancestry_chain.push(target);
        visited.insert(target.pid);

        let mut current = target;

        while ancestry_chain.len() < MAX_TREE_DEPTH {
            if let Some(parent_pid) = current.parent_pid {
                // Stop on self-referencing parent or null parent
                if parent_pid == 0 || parent_pid == current.pid {
                    break;
                }

                // Cycle detection: if parent PID has already been visited in this chain, stop
                if visited.contains(&parent_pid) {
                    break;
                }

                // Lookup parent in snapshot map
                if let Some(&parent_proc) = process_map.get(&parent_pid) {
                    visited.insert(parent_pid);
                    ancestry_chain.push(parent_proc);
                    current = parent_proc;
                } else {
                    // Parent process exited or is not discoverable in current snapshot
                    break;
                }
            } else {
                // Reached top-level root process with no parent PID
                break;
            }
        }

        // Reverse chain so it reads from Root (depth 0) down to Target (highest depth)
        ancestry_chain.reverse();

        ancestry_chain
            .into_iter()
            .enumerate()
            .map(|(depth, proc)| ProcessTreeNode {
                pid: proc.pid,
                name: proc.name.clone(),
                command_line: proc.command_line.clone(),
                is_target: proc.pid == target.pid,
                depth,
            })
            .collect()
    }

    /// Resolves the immediate parent process information if present in the snapshot map.
    pub fn resolve_parent(
        target: &ProcessInfo,
        process_map: &HashMap<u32, &ProcessInfo>,
    ) -> Option<ProcessParentInfo> {
        let parent_pid = target.parent_pid?;
        if parent_pid == 0 || parent_pid == target.pid {
            return None;
        }

        if let Some(&parent_proc) = process_map.get(&parent_pid) {
            Some(ProcessParentInfo {
                pid: parent_proc.pid,
                name: parent_proc.name.clone(),
                command_line: parent_proc.command_line.clone(),
            })
        } else {
            // Parent PID exists in OS record but process is not in snapshot
            Some(ProcessParentInfo {
                pid: parent_pid,
                name: format!("PID {}", parent_pid),
                command_line: None,
            })
        }
    }

    /// Collects a list of ancestor process references for analysis by detectors.
    pub fn collect_ancestors<'a>(
        target: &ProcessInfo,
        process_map: &'a HashMap<u32, &'a ProcessInfo>,
    ) -> Vec<&'a ProcessInfo> {
        let mut ancestors = Vec::new();
        let mut visited = HashSet::new();
        visited.insert(target.pid);

        let mut current = target;

        while ancestors.len() < MAX_TREE_DEPTH {
            if let Some(parent_pid) = current.parent_pid {
                if parent_pid == 0 || parent_pid == current.pid || visited.contains(&parent_pid) {
                    break;
                }

                if let Some(&parent_proc) = process_map.get(&parent_pid) {
                    visited.insert(parent_pid);
                    ancestors.push(parent_proc);
                    current = parent_proc;
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        ancestors
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::process::ProcessStatus;

    fn make_proc(pid: u32, parent_pid: Option<u32>, name: &str) -> ProcessInfo {
        ProcessInfo {
            pid,
            parent_pid,
            name: name.to_string(),
            executable_path: None,
            command_line: None,
            working_directory: None,
            status: ProcessStatus::Running,
        }
    }

    #[test]
    fn test_process_tree_construction_normal_hierarchy() {
        // Tree: 1 (System) -> 25 (Code.exe) -> 50 (powershell.exe) -> 100 (node.exe)
        let p1 = make_proc(1, None, "System");
        let p25 = make_proc(25, Some(1), "Code.exe");
        let p50 = make_proc(50, Some(25), "powershell.exe");
        let p100 = make_proc(100, Some(50), "node.exe");

        let mut map = HashMap::new();
        map.insert(1, &p1);
        map.insert(25, &p25);
        map.insert(50, &p50);
        map.insert(100, &p100);

        let tree = ProcessTreeBuilder::build_tree(&p100, &map);

        assert_eq!(tree.len(), 4);
        assert_eq!(tree[0].pid, 1);
        assert_eq!(tree[0].name, "System");
        assert_eq!(tree[0].depth, 0);
        assert!(!tree[0].is_target);

        assert_eq!(tree[1].pid, 25);
        assert_eq!(tree[1].name, "Code.exe");
        assert_eq!(tree[1].depth, 1);
        assert!(!tree[1].is_target);

        assert_eq!(tree[2].pid, 50);
        assert_eq!(tree[2].name, "powershell.exe");
        assert_eq!(tree[2].depth, 2);
        assert!(!tree[2].is_target);

        assert_eq!(tree[3].pid, 100);
        assert_eq!(tree[3].name, "node.exe");
        assert_eq!(tree[3].depth, 3);
        assert!(tree[3].is_target);
    }

    #[test]
    fn test_process_tree_cycle_protection_terminates_safely() {
        // Cycle: PID 100 -> Parent 50 -> Parent 100 (cycle!)
        let p100 = make_proc(100, Some(50), "node.exe");
        let p50 = make_proc(50, Some(100), "bad_parent.exe");

        let mut map = HashMap::new();
        map.insert(100, &p100);
        map.insert(50, &p50);

        let tree = ProcessTreeBuilder::build_tree(&p100, &map);

        // Traversal must terminate safely without looping indefinitely
        assert!(tree.len() <= 2);
        assert_eq!(tree.last().unwrap().pid, 100);
        assert!(tree.last().unwrap().is_target);
    }

    #[test]
    fn test_process_tree_self_parent_anomaly() {
        // Anomaly: PID 42 -> Parent 42
        let p42 = make_proc(42, Some(42), "self_referential.exe");
        let mut map = HashMap::new();
        map.insert(42, &p42);

        let tree = ProcessTreeBuilder::build_tree(&p42, &map);
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].pid, 42);
        assert!(tree[0].is_target);
    }

    #[test]
    fn test_process_tree_missing_parent_graceful_handling() {
        // Target PID 200 has Parent 999 which exited / is missing from snapshot
        let p200 = make_proc(200, Some(999), "worker.exe");
        let mut map = HashMap::new();
        map.insert(200, &p200);

        let tree = ProcessTreeBuilder::build_tree(&p200, &map);
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].pid, 200);
        assert!(tree[0].is_target);

        let parent = ProcessTreeBuilder::resolve_parent(&p200, &map);
        assert!(parent.is_some());
        assert_eq!(parent.unwrap().pid, 999);
    }

    #[test]
    fn test_process_tree_max_depth_bound() {
        // Create an artificial chain of 50 processes
        let mut procs = Vec::new();
        for i in 1..=50 {
            let parent_pid = if i == 1 { None } else { Some(i - 1) };
            procs.push(make_proc(i, parent_pid, &format!("proc_{}", i)));
        }

        let mut map = HashMap::new();
        for p in &procs {
            map.insert(p.pid, p);
        }

        let target = &procs[49]; // PID 50
        let tree = ProcessTreeBuilder::build_tree(target, &map);

        assert!(
            tree.len() <= MAX_TREE_DEPTH,
            "Tree depth must be capped at MAX_TREE_DEPTH ({}) but was {}",
            MAX_TREE_DEPTH,
            tree.len()
        );
        assert!(tree.last().unwrap().is_target);
    }
}
