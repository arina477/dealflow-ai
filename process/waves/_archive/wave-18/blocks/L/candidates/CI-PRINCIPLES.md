2. Before trusting green CI, confirm a workflow run executed on the exact pushed headSha, not that the push landed.
   Why: An empty commit or [skip ci] message yields no run; the push returns 200 but nothing runs.
