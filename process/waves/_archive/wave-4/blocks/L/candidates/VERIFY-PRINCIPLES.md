1. Test any path that recomputes a value from persisted data against the real DB wire format, not an echoing stub.
   Why: A stub returning the stored value verbatim cannot detect app-vs-DB serialization divergence.
