import type { Role } from './auth';

// ---------------------------------------------------------------------------
// Nav group identifiers
// ---------------------------------------------------------------------------

export type NavGroup = 'workspace' | 'config';

// ---------------------------------------------------------------------------
// A single sidebar nav destination
// ---------------------------------------------------------------------------

export interface NavItem {
  /** Human-readable sidebar label */
  label: string;
  /** Primary route this nav item links to */
  route: string;
  /** lucide-react icon name */
  icon: string;
  /** §10 sidebar group */
  group: NavGroup;
  /** The roles that may see + access this nav item */
  allowedRoles: ReadonlyArray<Role>;
}

// ---------------------------------------------------------------------------
// Route-entry — one row in roleRoutes
// Covers a primary route plus any sub-routes under it (e.g. /mandates/:id).
// The `navItem` field is present when this route has a direct sidebar link;
// sub-routes that share the parent nav item (e.g. /mandates/:id/buyers) carry
// the same navItem as the parent.
// ---------------------------------------------------------------------------

export interface RouteEntry {
  /**
   * Canonical route pattern.
   * Patterns with `:param` segments are matched by prefix/param awareness
   * (see `rolesForRoute` / `canAccess`).
   */
  pattern: string;
  allowedRoles: ReadonlyArray<Role>;
  /**
   * Defined when this pattern corresponds to a top-level sidebar nav item.
   * Sub-route entries reference the SAME nav item object as their parent.
   */
  navItem?: NavItem;
}

// ---------------------------------------------------------------------------
// THE single source of truth.
//
// Nav visibility and RBAC enforcement BOTH derive from this one array.
// No duplication: `navItemsForRole` reads `entry.navItem.allowedRoles`;
// `rolesForRoute` reads `entry.allowedRoles`. They are always in sync because
// every nav item's route pattern is also an entry in this table, and the
// nav item's `allowedRoles` is always IDENTICAL to the corresponding entry's
// `allowedRoles` (they reference the same array literal).
//
// §10 sidebar order: Workspace group first (Dashboard → Mandates → Sourcing →
// Compliance), then Config group (Team → Settings).
// ---------------------------------------------------------------------------

// ---------- Nav item definitions (defined once, referenced by route entries) ----------

const NAV_DASHBOARD: NavItem = {
  label: 'Dashboard',
  route: '/',
  icon: 'layout-dashboard',
  group: 'workspace',
  allowedRoles: ['advisor', 'analyst', 'compliance', 'admin'],
};

const NAV_MANDATES: NavItem = {
  label: 'Mandates',
  route: '/mandates',
  icon: 'briefcase',
  group: 'workspace',
  // Wave-8: admin added — mandate API allows admin for list/detail/create/configure.
  // nav⊆RBAC holds: the /mandates route entry below references these same roles.
  allowedRoles: ['advisor', 'admin', 'analyst'],
};

const NAV_SOURCING: NavItem = {
  label: 'Sourcing',
  route: '/sourcing',
  icon: 'database',
  group: 'workspace',
  allowedRoles: ['analyst'],
};

const NAV_COMPLIANCE: NavItem = {
  label: 'Compliance',
  route: '/compliance/queue',
  icon: 'shield-check',
  group: 'workspace',
  allowedRoles: ['compliance', 'advisor'],
};

const NAV_TEAM: NavItem = {
  label: 'Team',
  route: '/admin/users',
  icon: 'users',
  group: 'config',
  allowedRoles: ['admin'],
};

const NAV_SETTINGS: NavItem = {
  label: 'Settings',
  route: '/admin/settings',
  icon: 'settings',
  group: 'config',
  allowedRoles: ['admin'],
};

// Wave-16: Admin Activity nav item (/admin/activity).
// admin-only (advisor 403 / anon 401 — P-4 Finding 3).
// nav⊆RBAC: NAV_ADMIN_ACTIVITY.allowedRoles references the same array literal
// as the /admin/activity route entry below.
const NAV_ADMIN_ACTIVITY: NavItem = {
  label: 'Activity',
  route: '/admin/activity',
  icon: 'activity',
  group: 'config',
  allowedRoles: ['admin'],
};

// Wave-18 (task a5ba8068): Insights nav item (/insights).
// advisor + admin: summary analytics over the firm's own data (workspace-scoped).
// analyst excluded: advisory analytics are advisor-facing (mandate/pipeline/match).
// nav⊆RBAC: NAV_INSIGHTS.allowedRoles references the same array literal
// as the /insights route entry below. Per-advisor productivity is viewable by
// advisor (own data) and admin (firm-wide); admin-only filtering is service-layer.
const NAV_INSIGHTS: NavItem = {
  label: 'Insights',
  route: '/insights',
  icon: 'bar-chart-2',
  group: 'workspace',
  allowedRoles: ['advisor', 'admin'],
};

// Wave-20 (task b2acf4ce): Outreach Activity nav item (/outreach/activity).
// advisor + admin: internal advisory activity ledger (log outreach touches,
// track status, link to deal targets). analyst/compliance NOT permitted.
// nav⊆RBAC: NAV_OUTREACH_ACTIVITY.allowedRoles references the same array
// literal as the /outreach/activity route entry below.
const NAV_OUTREACH_ACTIVITY: NavItem = {
  label: 'Outreach Log',
  route: '/outreach/activity',
  icon: 'phone-call',
  group: 'workspace',
  allowedRoles: ['advisor', 'admin'],
};

// Wave-13: advisor added — advisor sees own-outreach entries (role-scoped in service);
// compliance sees org-wide. admin is NOT in the nav (admin uses the API directly, not
// the page UI). nav⊆RBAC holds: NAV_AUDIT_LOG.allowedRoles ⊆ the /compliance/audit-log
// route allowedRoles below (compliance+advisor ⊆ compliance+admin+advisor).
const NAV_AUDIT_LOG: NavItem = {
  label: 'Audit Log',
  route: '/compliance/audit-log',
  icon: 'scroll',
  group: 'workspace',
  allowedRoles: ['compliance', 'advisor'],
};

// Wave-5: Compliance Settings nav item (rules-engine config surface).
// Route /compliance/settings is compliance-only (RBAC unchanged from wave-4);
// we attach a navItem so it appears in the sidebar for compliance users.
// nav⊆RBAC holds by construction: navItem.allowedRoles references the same
// literal as the route entry's allowedRoles below.
const NAV_COMPLIANCE_SETTINGS: NavItem = {
  label: 'Rules',
  route: '/compliance/settings',
  icon: 'sliders',
  group: 'workspace',
  allowedRoles: ['compliance'],
};

// Wave-9: Buyer Universe nav item (analyst/advisor/admin — all ops; analyst is primary).
// nav⊆RBAC: NAV_BUYER_UNIVERSE.allowedRoles references the same array as
// the /buyer-universe route entry below.
const NAV_BUYER_UNIVERSE: NavItem = {
  label: 'Buyer Universe',
  route: '/buyer-universe',
  icon: 'users-round',
  group: 'workspace',
  allowedRoles: ['analyst', 'advisor', 'admin'],
};

// Wave-10: Matches nav item (advisor/admin create+mutate; analyst read-only).
// advisor is the primary persona (runs scoring + reviews + hands off).
// analyst can read results; cannot create or mutate.
// nav⊆RBAC: NAV_MATCHES.allowedRoles references the same array as the
// /matches route entry below.
const NAV_MATCHES: NavItem = {
  label: 'Matches',
  route: '/matches',
  icon: 'target',
  group: 'workspace',
  allowedRoles: ['advisor', 'admin', 'analyst'],
};

// Wave-11: Outreach Templates nav item (advisor/analyst draft; compliance approve).
// advisor is the primary compose persona; compliance-only approves versions.
// nav⊆RBAC: NAV_TEMPLATES.allowedRoles references the same array as the
// /outreach-templates route entry below.
const NAV_OUTREACH_TEMPLATES: NavItem = {
  label: 'Templates',
  route: '/outreach-templates',
  icon: 'file-text',
  group: 'workspace',
  allowedRoles: ['advisor', 'analyst', 'compliance'],
};

// Wave-11: Outreach nav item (advisor compose; compliance read-only visibility).
// advisor is the primary compose persona. compliance may view outreach records.
// nav⊆RBAC: NAV_OUTREACH.allowedRoles references the same array as the
// /outreach route entry below.
const NAV_OUTREACH: NavItem = {
  label: 'Outreach',
  route: '/outreach',
  icon: 'send',
  group: 'workspace',
  allowedRoles: ['advisor', 'compliance'],
};

// Wave-12: Pipeline nav item (advisor primary — enroll + transition; compliance read-only).
// advisor is the primary pipeline persona (enroll from outreach + move stages).
// compliance may view the pipeline board and event timeline (read-only visibility).
// nav⊆RBAC: NAV_PIPELINE.allowedRoles references the same array as the
// /pipeline route entry below.
const NAV_PIPELINE: NavItem = {
  label: 'Pipeline',
  route: '/pipeline',
  icon: 'kanban',
  group: 'workspace',
  allowedRoles: ['advisor', 'compliance'],
};

// ---------- Route entries (the canonical role → route matrix) ----------

export const roleRoutes: ReadonlyArray<RouteEntry> = [
  // --- Dashboard ---
  {
    pattern: '/',
    allowedRoles: ['advisor', 'analyst', 'compliance', 'admin'],
    navItem: NAV_DASHBOARD,
  },

  // --- Mandates group ---
  // Wave-8 B-1: admin added to mandates routes.
  //   /mandates — list+detail read (GET): advisor, admin, analyst.
  //   /mandates/new — create/configure (POST, PATCH): advisor, admin (NOT analyst).
  //   /mandates/:id — detail read: advisor, admin, analyst.
  //   Sub-routes (buyers, outreach, matches) also updated for admin access consistency.
  // The MandateController uses two role constants derived from this table:
  //   MANDATES_READ_ROLES  = rolesForRoute('/mandates')     → advisor, admin, analyst
  //   MANDATES_WRITE_ROLES = rolesForRoute('/mandates/new') → advisor, admin
  // nav⊆RBAC invariant holds: NAV_MANDATES.allowedRoles references the same set
  // as the /mandates route entry below.
  {
    pattern: '/mandates',
    allowedRoles: ['advisor', 'admin', 'analyst'],
    navItem: NAV_MANDATES,
  },
  {
    // POST /mandates (create) + PATCH /mandates/:id (configure) — advisor, admin.
    // Analyst is read-only for mandates; write access requires advisor or admin.
    pattern: '/mandates/new',
    allowedRoles: ['advisor', 'admin'],
  },
  {
    // GET /mandates/jurisdictions — advisor-readable list of active disclaimer
    // template jurisdictions. Gated by the same write-roles (advisor, admin) so
    // advisors (the primary create-mandate persona) can fetch the dropdown list.
    // Analyst is intentionally excluded (read-only, cannot create mandates).
    // Wave-8 C-2 fix: replaces the admin-only /compliance/disclaimers fetch.
    pattern: '/mandates/jurisdictions',
    allowedRoles: ['advisor', 'admin'],
  },
  {
    pattern: '/mandates/:id',
    allowedRoles: ['advisor', 'admin', 'analyst'],
  },
  {
    pattern: '/mandates/:id/buyers',
    allowedRoles: ['advisor', 'admin', 'analyst'],
  },
  {
    pattern: '/mandates/:id/outreach',
    allowedRoles: ['advisor', 'admin', 'analyst'],
  },
  {
    pattern: '/mandates/:id/matches',
    allowedRoles: ['advisor', 'admin'],
  },
  // --- Pipeline group (wave-12) ---
  // advisor: enroll + transition + note (all mutations).
  // compliance: read-only visibility (board + events).
  // nav⊆RBAC invariant holds: NAV_PIPELINE.allowedRoles references the same
  // set as the /pipeline route entry below.
  {
    pattern: '/pipeline',
    allowedRoles: ['advisor', 'compliance'],
    navItem: NAV_PIPELINE,
  },
  {
    // POST /pipeline (enroll) — advisor only.
    pattern: '/pipeline/new',
    allowedRoles: ['advisor'],
  },
  {
    // PATCH /pipeline/:id/stage (transition) — advisor only.
    // GET /pipeline/:id/events (timeline read) — advisor + compliance.
    // POST /pipeline/:id/notes (addNote) — advisor + compliance.
    // Note: /pipeline/:id sub-routes share this pattern entry for list/detail;
    // write-only guards are enforced in the controller via @Roles derivation.
    pattern: '/pipeline/:id',
    allowedRoles: ['advisor', 'compliance'],
  },
  {
    // PATCH /pipeline/:id/stage (stage transition) — advisor only.
    pattern: '/pipeline/:id/stage',
    allowedRoles: ['advisor'],
  },
  {
    // POST /pipeline/:id/notes (add note) — advisor + compliance.
    // GET /pipeline/:id/events (event timeline) — advisor + compliance.
    pattern: '/pipeline/:id/notes',
    allowedRoles: ['advisor', 'compliance'],
  },
  {
    // GET /pipeline/:id/events — ordered event timeline.
    pattern: '/pipeline/:id/events',
    allowedRoles: ['advisor', 'compliance'],
  },

  // --- Matches group (wave-10) ---
  // advisor/admin: create match runs + mutate (disposition, handoff).
  // analyst: read-only (GET /matches, /matches/:id, /matches/:id/shortlist).
  // nav⊆RBAC invariant holds: NAV_MATCHES.allowedRoles references the same
  // set as the /matches route entry below (advisor, admin, analyst).
  {
    pattern: '/matches',
    allowedRoles: ['advisor', 'admin', 'analyst'],
    navItem: NAV_MATCHES,
  },
  {
    // POST /matches (create match run) — advisor, admin only.
    pattern: '/matches/new',
    allowedRoles: ['advisor', 'admin'],
  },
  {
    // GET /matches/:id — detail read (all three roles).
    // POST /matches/:id/handoff — advisor, admin only (enforced in controller).
    pattern: '/matches/:id',
    allowedRoles: ['advisor', 'admin', 'analyst'],
  },
  {
    // PATCH /matches/:id/candidates/:cid (disposition) — advisor, admin only.
    pattern: '/matches/:id/candidates/:cid',
    allowedRoles: ['advisor', 'admin'],
  },
  {
    // GET /matches/:id/shortlist — read-only (all three roles).
    pattern: '/matches/:id/shortlist',
    allowedRoles: ['advisor', 'admin', 'analyst'],
  },

  // --- Buyer Universe group (wave-9) ---
  // All three roles (analyst/advisor/admin) can access all buyer-universe operations.
  // analyst is the primary persona; advisor and admin have full access too.
  // nav⊆RBAC invariant holds: NAV_BUYER_UNIVERSE.allowedRoles references the same
  // set as the /buyer-universe route entry below.
  {
    pattern: '/buyer-universe',
    allowedRoles: ['analyst', 'advisor', 'admin'],
    navItem: NAV_BUYER_UNIVERSE,
  },
  {
    // POST /buyer-universe (assemble)
    pattern: '/buyer-universe/new',
    allowedRoles: ['analyst', 'advisor', 'admin'],
  },
  {
    // GET /buyer-universe/:id, POST /buyer-universe/:id/filter,
    // POST /buyer-universe/:id/enrich, GET /buyer-universe/:id/gaps,
    // POST /buyer-universe/:id/submit
    pattern: '/buyer-universe/:id',
    allowedRoles: ['analyst', 'advisor', 'admin'],
  },
  {
    // PATCH /buyer-universe/:id/candidates/:candidateId
    pattern: '/buyer-universe/:id/candidates/:candidateId',
    allowedRoles: ['analyst', 'advisor', 'admin'],
  },

  // --- Sourcing group ---
  {
    pattern: '/sourcing',
    allowedRoles: ['analyst'],
    navItem: NAV_SOURCING,
  },
  // Wave-6: /companies repointed to /sourcing/companies (namespace consolidation per P-3 Delta 5).
  // The bare /companies placeholder (no page existed — verified no (app)/companies route dir) is
  // superseded by the canonical /sourcing/companies pattern so all sourcing routes share a namespace.
  // rbac.test.ts updated accordingly (karen LOW — named B-1/B-2 step).
  {
    pattern: '/sourcing/companies',
    allowedRoles: ['analyst'],
  },
  {
    pattern: '/sourcing/companies/:id',
    allowedRoles: ['analyst'],
  },
  // Wave-6: API route entries for the sourcing data spine (analyst + admin per P-3 Action 3).
  // No navItem — these are API-only endpoints; the sidebar nav for sourcing is /sourcing (NAV_SOURCING).
  // Admin allowed on sync + resolve (config/ops surface); analyst is the primary sourcing persona.
  // Wave-7: POST /sourcing/connections + GET /sourcing/connections (AC-SEED create/list).
  // No navItem — API-only endpoints; the sourcing workspace nav is NAV_SOURCING (/sourcing).
  // analyst + admin: analyst is the primary sourcing persona; admin for config/ops management.
  {
    pattern: '/sourcing/connections',
    allowedRoles: ['analyst', 'admin'],
  },
  {
    // POST /sourcing/connections/:id/sync — on-demand ETL trigger.
    pattern: '/sourcing/connections/:id/sync',
    allowedRoles: ['analyst', 'admin'],
  },
  {
    // POST /sourcing/dedupe-candidates/:id/resolve — human merge/reject decision.
    // Audited via AuditService.append (sourcing-dedupe-resolve) in the same tx.
    pattern: '/sourcing/dedupe-candidates/:id/resolve',
    allowedRoles: ['analyst', 'admin'],
  },
  {
    pattern: '/templates',
    allowedRoles: ['analyst', 'compliance'],
  },

  // --- Compliance group ---
  {
    pattern: '/compliance/queue',
    allowedRoles: ['compliance', 'advisor'],
    navItem: NAV_COMPLIANCE,
  },
  {
    // Wave-13: READ endpoint + page now allows compliance (org-wide) + admin (org-wide)
    // + advisor (own-outreach only, role-scoped server-side by RecordkeepingService).
    // nav⊆RBAC: NAV_AUDIT_LOG.allowedRoles ['compliance','advisor'] ⊆ this set.
    // admin excluded from the NAV item (admin accesses the API directly, not the page).
    pattern: '/compliance/audit-log',
    allowedRoles: ['compliance', 'admin', 'advisor'],
    navItem: NAV_AUDIT_LOG,
  },
  {
    // INTENTIONAL split from the page above: the verify ENDPOINT additionally
    // allows admin for API/automation-driven ops verification (no nav item — it
    // is API-only, not a page in admin's navigation). The page stays compliance's
    // human surface; the endpoint is the machine/ops surface. Not a bug.
    pattern: '/compliance/audit-log/verify',
    allowedRoles: ['compliance', 'admin'],
  },
  {
    // Wave-13: POST /compliance/audit-log/export — compliance + admin ONLY.
    // advisor has NO export right (403) — enforced in RecordkeepingService + here.
    // No navItem — the export is an action within the /compliance/audit-log page.
    pattern: '/compliance/audit-log/export',
    allowedRoles: ['compliance', 'admin'],
  },
  {
    // Wave-14 (task f5074df8): /compliance/oversight — compliance + admin ONLY.
    // READ-focused gate-outcome oversight surface over outreach records.
    // DISTINCT from /compliance-queue (template version-approval; wave-11) and
    // /compliance/queue (reserved for F10 approvals). Advisor is DENIED (403/redirect).
    // No navItem — oversight is an in-compliance sidebar sub-surface, not a top-level nav item.
    pattern: '/compliance/oversight',
    allowedRoles: ['compliance', 'admin'],
  },
  {
    // Wave-5: navItem attached so compliance sees 'Rules' in sidebar.
    // allowedRoles remains compliance-only (unchanged from wave-4).
    // The SoD APPROVER role restriction ('compliance' only, admin excluded)
    // is enforced in the gate service (B-2), NOT here — these CRUD routes
    // allow admin for config management, per the plan's SoD distinction.
    pattern: '/compliance/settings',
    allowedRoles: ['compliance'],
    navItem: NAV_COMPLIANCE_SETTINGS,
  },
  // Wave-5: CRUD API route entries — compliance/admin (config management).
  // SoD distinction: these are config-management routes (compliance/admin);
  // the SoD APPROVER check (compliance-only) is enforced server-side in the
  // gate service's sod evaluator, not via route RBAC.
  {
    pattern: '/compliance/rules',
    allowedRoles: ['compliance', 'admin'],
  },
  {
    pattern: '/compliance/suppression',
    allowedRoles: ['compliance', 'admin'],
  },
  {
    pattern: '/compliance/disclaimers',
    allowedRoles: ['compliance', 'admin'],
  },
  {
    pattern: '/compliance/summary',
    allowedRoles: ['compliance', 'admin'],
  },

  // --- Outreach Templates group (wave-11) ---
  // advisor/analyst: draft templates + request approval.
  // compliance: approve or reject versions.
  // nav⊆RBAC invariant holds: NAV_OUTREACH_TEMPLATES.allowedRoles references the same
  // set as the /outreach-templates route entry below.
  {
    pattern: '/outreach-templates',
    allowedRoles: ['advisor', 'analyst', 'compliance'],
    navItem: NAV_OUTREACH_TEMPLATES,
  },
  {
    // POST /outreach-templates (create template + v1) — advisor, analyst.
    pattern: '/outreach-templates/new',
    allowedRoles: ['advisor', 'analyst'],
  },
  {
    // GET /outreach-templates/:id — detail (advisor, analyst, compliance).
    // POST /outreach-templates/:id/versions — draft new version (advisor, analyst).
    pattern: '/outreach-templates/:id',
    allowedRoles: ['advisor', 'analyst', 'compliance'],
  },
  {
    // POST /outreach-templates/:id/versions/:vid/request-approval — advisor, analyst.
    pattern: '/outreach-templates/:id/versions/:vid/request-approval',
    allowedRoles: ['advisor', 'analyst'],
  },
  {
    // POST /outreach-templates/:id/versions/:vid/approve — compliance ONLY (SoD).
    pattern: '/outreach-templates/:id/versions/:vid/approve',
    allowedRoles: ['compliance'],
  },
  {
    // POST /outreach-templates/:id/versions/:vid/reject — compliance ONLY (SoD).
    pattern: '/outreach-templates/:id/versions/:vid/reject',
    allowedRoles: ['compliance'],
  },

  // --- Outreach group (wave-11) ---
  // advisor: compose outreach (triggers non-bypassable pre-send gate).
  // compliance: read outreach records (visibility for compliance queue).
  // nav⊆RBAC invariant holds: NAV_OUTREACH.allowedRoles references the same
  // set as the /outreach route entry below.
  {
    pattern: '/outreach',
    allowedRoles: ['advisor', 'compliance'],
    navItem: NAV_OUTREACH,
  },
  {
    // POST /outreach (compose — advisor only).
    pattern: '/outreach/new',
    allowedRoles: ['advisor'],
  },
  {
    // GET /outreach/:id — detail (advisor, compliance).
    pattern: '/outreach/:id',
    allowedRoles: ['advisor', 'compliance'],
  },

  // --- Outreach Activity group (wave-20 M9 outreach-activity tracker) ---
  // advisor: create + update + status-transition + cancel (all mutations).
  // admin:   same as advisor (admin oversees advisor activity).
  // analyst/compliance: NOT permitted (internal advisory activity ledger).
  {
    // GET /outreach-activity (list) — advisor, admin.
    // POST /outreach-activity (create) — advisor, admin.
    pattern: '/outreach-activity',
    allowedRoles: ['advisor', 'admin'],
  },
  {
    // PATCH /outreach-activity/:id (update / status-transition / cancel) — advisor, admin.
    pattern: '/outreach-activity/:id',
    allowedRoles: ['advisor', 'admin'],
  },
  // Wave-20 (task b2acf4ce): /outreach/activity page routes.
  // The page at /outreach/activity renders the outreach-activity panel (create
  // form + my-open-touches list + status transitions). RBAC mirrors the API:
  // advisor + admin only. analyst/compliance denied → redirect('/').
  // nav⊆RBAC: NAV_OUTREACH_ACTIVITY.allowedRoles references the same array.
  {
    pattern: '/outreach/activity',
    allowedRoles: ['advisor', 'admin'],
    navItem: NAV_OUTREACH_ACTIVITY,
  },

  // --- Admin / Config group ---
  {
    pattern: '/admin/users',
    allowedRoles: ['admin'],
    navItem: NAV_TEAM,
  },
  {
    // POST /admin/users/invite — create invite record (no email send).
    pattern: '/admin/users/invite',
    allowedRoles: ['admin'],
  },
  {
    // PATCH /admin/users/:id/role — change user role.
    pattern: '/admin/users/:id/role',
    allowedRoles: ['admin'],
  },
  {
    // POST /admin/users/:id/deactivate — soft-deactivate a user.
    pattern: '/admin/users/:id/deactivate',
    allowedRoles: ['admin'],
  },
  {
    // Wave-16 (task 042cf4e6): POST /admin/users/:id/reactivate — reactivate a user.
    // Mirrors /admin/users/:id/deactivate (same RBAC). admin-only.
    pattern: '/admin/users/:id/reactivate',
    allowedRoles: ['admin'],
  },
  {
    // Wave-15: /admin/workspace-settings — firm profile + default compliance profile.
    // admin-only (full CRUD over firm settings). RBAC: admin.
    // nav⊆RBAC: NAV_SETTINGS references /admin/settings (shell placeholder);
    // this API route is the canonical REST endpoint for workspace settings data.
    pattern: '/admin/workspace-settings',
    allowedRoles: ['admin'],
    navItem: NAV_SETTINGS,
  },
  {
    // Legacy /admin/settings route kept for shell nav compatibility.
    // Points at the same page as /admin/workspace-settings.
    pattern: '/admin/settings',
    allowedRoles: ['admin'],
  },
  {
    // GET /admin/integrations — list data source connections.
    // POST /admin/integrations — create a new connection.
    pattern: '/admin/integrations',
    allowedRoles: ['admin'],
  },
  {
    // PATCH /admin/integrations/:id — update a connection (metadata + credential).
    // Wave-15: credential is encrypted by the service before DB write.
    pattern: '/admin/integrations/:id',
    allowedRoles: ['admin'],
  },
  {
    // PATCH /admin/integrations/:id/toggle — enable/disable a connection.
    pattern: '/admin/integrations/:id/toggle',
    allowedRoles: ['admin'],
  },
  // Wave-16 (task 8bb0a22f): Admin Activity page + API.
  // Admin-only (advisor 403 / anon 401 — P-4 Finding 3, real control).
  // Read-only-immutable: opening this page/endpoint writes ZERO audit rows.
  // nav⊆RBAC: NAV_ADMIN_ACTIVITY.allowedRoles references the same array literal.
  {
    pattern: '/admin/activity',
    allowedRoles: ['admin'],
    navItem: NAV_ADMIN_ACTIVITY,
  },
  {
    // GET /admin/activity-data — REST API endpoint (non-page-colliding proxy path).
    // No navItem — API-only endpoint; the sidebar nav is /admin/activity above.
    pattern: '/admin/activity-data',
    allowedRoles: ['admin'],
  },

  // Wave-18 (task a5ba8068): Insights page + analytics API.
  // advisor + admin: workspace-scoped analytics (FORCE RLS; no cross-firm leak).
  // Read-only; GET /analytics returns the 4-family AnalyticsSummary shape.
  // nav⊆RBAC: NAV_INSIGHTS.allowedRoles references the same array literal.
  {
    pattern: '/insights',
    allowedRoles: ['advisor', 'admin'],
    navItem: NAV_INSIGHTS,
  },
  {
    // GET /analytics — REST API endpoint (non-page-colliding proxy path).
    // No navItem — API-only endpoint; the sidebar nav is /insights above.
    // advisor + admin (same as /insights; per-productivity admin-only scoping
    // is enforced in the service layer, not at the route level).
    pattern: '/analytics',
    allowedRoles: ['advisor', 'admin'],
  },

  // Wave-19 (task 69387b56): Match-feedback calibration API.
  // advisor + admin: workspace-scoped calibration over match_candidates.
  // Read-only; GET /match-feedback returns the CalibrationSummary shape.
  // analyst excluded (advisory calibration, same pattern as /analytics).
  // No navItem — API-only endpoint; displayed as a section on /insights page.
  {
    pattern: '/match-feedback',
    allowedRoles: ['advisor', 'admin'],
  },
];

// ---------------------------------------------------------------------------
// Public allowlist — routes that bypass auth/RBAC entirely.
// B-2 and B-3 import `isPublicRoute` instead of hardcoding these.
// ---------------------------------------------------------------------------

const PUBLIC_PREFIXES: ReadonlyArray<string> = ['/auth', '/health'];

/**
 * Returns true if `route` is on the public allowlist (no session or role
 * required). Matches `/auth/*` and `/health` (exact or with a trailing path).
 */
export function isPublicRoute(route: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => route === prefix || route.startsWith(`${prefix}/`) || route.startsWith(`${prefix}?`)
  );
}

// ---------------------------------------------------------------------------
// Route normalization
//
// The RBAC matchers (rolesForRoute / canAccess) match against canonical
// patterns that have NO query string and NO trailing slash. A caller-supplied
// URL like '/compliance/summary/' or '/compliance/summary?x=1' must be reduced
// to its canonical form BEFORE matching, so both matchers treat URLs the same
// way `isPublicRoute` already does (it prefix-matches on `/` and `?`). Without
// this, a legit URL with a trailing slash or query would fail-closed to [] and
// wrongly 403/redirect. The root route '/' is preserved (never stripped to '').
// ---------------------------------------------------------------------------

function normalizeRoute(route: string): string {
  // Strip query string (everything from the first '?') and hash fragment.
  let normalized = route.split('?')[0]?.split('#')[0] ?? route;
  // Strip a single trailing slash, but never reduce the root '/' to ''.
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Route-pattern matching helper
//
// Converts a pattern like `/mandates/:id/buyers` into a regex that matches
// real routes like `/mandates/abc123/buyers`.
// Segments starting with `:` match one non-empty, non-slash path segment.
// ---------------------------------------------------------------------------

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withParams = escaped.replace(/:[\w]+/g, '[^/]+');
  return new RegExp(`^${withParams}$`);
}

/**
 * Returns the Role[] that are permitted for the given concrete route.
 * Route-pattern matching handles `:param` segments (e.g. `/mandates/:id`).
 * Returns an empty array for routes not in the table (default-deny).
 *
 * Does NOT include public routes — call `isPublicRoute` first if you need
 * to handle `/auth/*` or `/health`.
 */
export function rolesForRoute(route: string): ReadonlyArray<Role> {
  // Normalize (strip query + trailing slash) so URLs are matched identically
  // to isPublicRoute — a trailing slash or query must NOT fail-closed to [].
  const normalized = normalizeRoute(route);
  // Exact match first (faster and avoids regex for the common case)
  for (const entry of roleRoutes) {
    if (entry.pattern === normalized) {
      return entry.allowedRoles;
    }
  }
  // Pattern match (`:param` segments)
  for (const entry of roleRoutes) {
    if (entry.pattern.includes(':')) {
      if (patternToRegex(entry.pattern).test(normalized)) {
        return entry.allowedRoles;
      }
    }
  }
  return [];
}

/**
 * Returns true if `role` may access `route`.
 * Public routes always return true; routes not in the table return false.
 */
export function canAccess(role: Role, route: string): boolean {
  // Normalize before both checks so a trailing slash / query behaves
  // identically across isPublicRoute and rolesForRoute (rolesForRoute
  // normalizes internally too; normalizing here keeps the public-route check
  // consistent with the matrix check).
  const normalized = normalizeRoute(route);
  if (isPublicRoute(normalized)) return true;
  return (rolesForRoute(normalized) as Role[]).includes(role);
}

// ---------------------------------------------------------------------------
// Nav item helpers
// ---------------------------------------------------------------------------

/**
 * Returns the ordered sidebar nav items that `role` is permitted to see.
 * Order follows the §10 canonical order (Workspace group first, Config group
 * second). Derived entirely from `roleRoutes` — no separate lookup table.
 *
 * nav⊆RBAC invariant: every item returned satisfies `canAccess(role, item.route)`
 * by construction, because `item.allowedRoles` is the SAME array referenced in
 * the corresponding `roleRoutes` entry.
 */
export function navItemsForRole(role: Role): NavItem[] {
  const seen = new Set<string>();
  const items: NavItem[] = [];

  for (const entry of roleRoutes) {
    if (!entry.navItem) continue;
    const navItem = entry.navItem;
    if (seen.has(navItem.route)) continue;
    if ((navItem.allowedRoles as Role[]).includes(role)) {
      items.push(navItem);
      seen.add(navItem.route);
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Re-export nav item definitions for consumers that need the full set
// (e.g. design-time enumeration, Storybook, admin tooling)
// ---------------------------------------------------------------------------

export const ALL_NAV_ITEMS: ReadonlyArray<NavItem> = [
  NAV_DASHBOARD,
  NAV_MANDATES,
  NAV_MATCHES,
  NAV_BUYER_UNIVERSE,
  NAV_OUTREACH_TEMPLATES,
  NAV_OUTREACH,
  NAV_PIPELINE,
  NAV_SOURCING,
  NAV_COMPLIANCE,
  NAV_AUDIT_LOG,
  NAV_COMPLIANCE_SETTINGS,
  NAV_TEAM,
  NAV_SETTINGS,
  // Wave-16: Admin Activity nav item.
  NAV_ADMIN_ACTIVITY,
  // Wave-18: Insights nav item.
  NAV_INSIGHTS,
  // Wave-20: Outreach Activity nav item.
  NAV_OUTREACH_ACTIVITY,
];
