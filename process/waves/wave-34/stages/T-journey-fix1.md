# Wave 34 — P0 SSR-500 FIXED + verified
Root cause: AppShell.tsx (Server Component wrapping all authed routes) had onFocus/onBlur handlers on the skip-link <a> — Next.js 14 hard-errors on event handlers in Server Components → 500 on every authed page. Fix (b557ac7): extracted skip-link to a client component (SkipLink.tsx). Deployed (bbbd7e5b).
VERIFIED via browser (arina admin): /, /mandates, /matches, /pipeline, /outreach ALL render HTTP 200 (app shell + nav visible), 0 web 5xx. The deployed app is USABLE again.
Remaining M6 slice: the SoD proof (advisor composes → compliance approves, sender≠approver → tracked send) + matching + pipeline re-run — needs advisor + compliance role-users (admin is excluded from M6 core by design).
