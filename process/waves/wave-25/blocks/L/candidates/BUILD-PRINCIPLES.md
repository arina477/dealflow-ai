11. A mechanical guard or CI check must include fault-injection fixtures per bypass class, not only happy-path tests.
   Why: Happy-path-only self-tests leave bypass inputs unprobed, so the guard fails to block them.
