4. Any hand-authored drizzle migration must appear in `_journal.json` with a `when` greater than all prior entries.
   Why: drizzle skips a migration with a missing or stale `when` while reporting success.
