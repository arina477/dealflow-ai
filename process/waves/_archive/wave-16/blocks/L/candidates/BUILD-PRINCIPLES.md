8. Use an advisory lock when a concurrent uniqueness or cardinality invariant has non-immutable or multi-row predicates.
   Why: A partial index rejects non-immutable predicates; row FOR UPDATE misses disjoint members.
