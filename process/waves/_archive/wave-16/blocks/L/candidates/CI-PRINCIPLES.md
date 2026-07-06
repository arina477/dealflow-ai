1. Verify deployed commit via the deployment's commitHash field, not the app self-reported /health version.
   Why: The /health version reads a static env var that can lag the actual deployed commit.
