7. Every read inside a runInTransaction block must use the tx-scoped repository handle, not the module-level one.
   Why: A module-level read runs off-snapshot, so guards and audit fields see pre-transaction state.
