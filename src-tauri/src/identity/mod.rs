pub mod detector;
pub mod service;
pub mod tree;

pub use detector::{PackageManagerDetector, RuntimeDetector};
pub use service::{ProcessIdentityEnricher, ProcessIdentityService};
pub use tree::{ProcessTreeBuilder, MAX_TREE_DEPTH};
