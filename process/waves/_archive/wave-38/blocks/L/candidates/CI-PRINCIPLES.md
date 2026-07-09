5. Verify a migration applied by matching its file hash in the applied-migrations table, never by a green migrate exit.
   Why: Ordered-journal tools skip out-of-order entries and still exit 0, hiding un-applied schema.
