// --- Wave-19 match-feedback calibration contracts (task 69387b56) ---
export type {
  CalibrationBand,
  CalibrationSummary,
  DimensionLift,
  DimensionLiftHalf,
  FitScoreBand,
} from './match-feedback';
export {
  calibrationBandSchema,
  calibrationSummarySchema,
  dimensionLiftHalfSchema,
  dimensionLiftSchema,
  fitScoreBandEnum,
} from './match-feedback';

// --- Wave-18 analytics contracts (task a5ba8068) ---

// --- Wave-16 admin-hardening contracts ---
export type {
  AdminActivityAction,
  AdminActivityQuery,
  AdminActivityResponse,
  AdminActivityRow,
} from './admin-activity';
export {
  adminActivityActionEnum,
  adminActivityQuerySchema,
  adminActivityResponseSchema,
  adminActivityRowSchema,
} from './admin-activity';
export type {
  AdvisorActivityRow,
  AdvisorProductivity,
  AnalyticsSummary,
  MandateThroughput,
  MatchDisposition,
  OutreachGateOutcomes,
} from './analytics';
export {
  advisorActivityRowSchema,
  advisorProductivitySchema,
  analyticsSummarySchema,
  mandateThroughputSchema,
  matchDispositionSchema,
  outreachGateOutcomesSchema,
} from './analytics';
export type {
  AuditAction,
  AuditBreakReason,
  AuditEntryInput,
  AuditLogEntry,
  AuditVerifyResponse,
} from './audit';
export {
  auditActionEnum,
  auditBreakReasonEnum,
  auditEntryInputSchema,
  auditLogEntrySchema,
  auditVerifyResponseSchema,
  GENESIS_PREV_HASH,
} from './audit';
export type {
  InviteCreateRequest,
  InviteCreateResponse,
  LoginRequest,
  LoginResponse,
  MeResponse,
  ResetConfirm,
  ResetRequest,
  Role,
  SignupRequest,
  SignupResponse,
} from './auth';
export {
  inviteCreateRequestSchema,
  inviteCreateResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
  meResponseSchema,
  resetConfirmSchema,
  resetRequestSchema,
  roleEnum,
  signupRequestSchema,
  signupResponseSchema,
} from './auth';
export type {
  BuyerUniverse,
  BuyerUniverseAssembleInput,
  BuyerUniverseCandidate,
  BuyerUniverseCandidateMembershipStatus,
  BuyerUniverseCandidatePatchInput,
  BuyerUniverseDetail,
  BuyerUniverseEnrichInput,
  BuyerUniverseFilterInput,
  BuyerUniverseGap,
  BuyerUniverseGapsResponse,
  BuyerUniverseListFilter,
  BuyerUniverseStatus,
  BuyerUniverseSubmitInput,
  EnrichedCandidate,
  EnrichedContact,
} from './buyer-universe';
export {
  buyerUniverseAssembleInputSchema,
  buyerUniverseCandidateMembershipStatusEnum,
  buyerUniverseCandidatePatchInputSchema,
  buyerUniverseCandidateSchema,
  buyerUniverseDetailSchema,
  buyerUniverseEnrichInputSchema,
  buyerUniverseFilterInputSchema,
  buyerUniverseGapSchema,
  buyerUniverseGapsResponseSchema,
  buyerUniverseListFilterSchema,
  buyerUniverseSchema,
  buyerUniverseStatusEnum,
  buyerUniverseSubmitInputSchema,
  enrichedCandidateSchema,
  enrichedContactSchema,
} from './buyer-universe';
export type { ComplianceSummaryResponse } from './compliance';
export { complianceSummaryResponseSchema } from './compliance';
export type {
  BlockReason,
  BlockReasonCode,
  GateContext,
  GateVerdict,
} from './compliance-gate';
export {
  blockReasonEnum,
  blockReasonSchema,
  contentHashMismatchBlockSchema,
  gateContextSchema,
  gateVerdictSchema,
  missingDisclaimerBlockSchema,
  noApprovalBlockSchema,
  sodBlockSchema,
  suppressionBlockSchema,
  versionBindingBlockSchema,
} from './compliance-gate';
export type {
  ApprovalCreate,
  ApprovalStatus,
  ComplianceApproval,
  ComplianceRule,
  ComplianceRuleType,
  DisclaimerCreate,
  DisclaimerTemplate,
  DisclaimerUpdate,
  RuleCreate,
  RuleUpdate,
  SuppressionCreate,
  SuppressionEntry,
  SuppressionMatchType,
} from './compliance-rules';
export {
  approvalCreateSchema,
  approvalStatusEnum,
  complianceApprovalSchema,
  complianceRuleSchema,
  complianceRuleTypeEnum,
  disclaimerCreateSchema,
  disclaimerTemplateSchema,
  disclaimerUpdateSchema,
  ruleCreateSchema,
  ruleUpdateSchema,
  suppressionCreateSchema,
  suppressionEntrySchema,
  suppressionMatchTypeEnum,
} from './compliance-rules';
export type {
  DataSourceConnectionAdminListResponse,
  DataSourceConnectionAdminRecord,
  DataSourceConnectionConfig,
  DataSourceConnectionToggleInput,
  DataSourceConnectionUpsertInput,
} from './data-source-admin';
export {
  dataSourceConnectionAdminListResponseSchema,
  dataSourceConnectionAdminRecordSchema,
  dataSourceConnectionConfigSchema,
  dataSourceConnectionToggleSchema,
  dataSourceConnectionUpsertSchema,
} from './data-source-admin';
export { parseEnv } from './env';
export type { HealthResponse } from './health';
export { healthResponseSchema } from './health';
export type {
  AvailableJurisdiction,
  AvailableJurisdictionsResponse,
  Mandate,
  MandateAcknowledgments,
  MandateBuyerCriteria,
  MandateComplianceProfile,
  MandateConfigureInput,
  MandateCreateInput,
  MandateDetail,
  MandateListFilter,
  MandateStatus,
} from './mandate';
export {
  availableJurisdictionSchema,
  availableJurisdictionsResponseSchema,
  mandateAcknowledgmentsSchema,
  mandateBuyerCriteriaSchema,
  mandateComplianceProfileSchema,
  mandateConfigureSchema,
  mandateCreateSchema,
  mandateDetailSchema,
  mandateListFilterSchema,
  mandateSchema,
  mandateStatusEnum,
} from './mandate';
export type {
  DispositionInput,
  HandoffInput,
  MatchCandidate,
  MatchCandidateDisposition,
  MatchListFilter,
  MatchRankedList,
  MatchRun,
  MatchRunCreateInput,
  MatchRunStatus,
  ScoreBreakdown,
  Shortlist,
} from './matching';
export {
  dispositionInputSchema,
  handoffInputSchema,
  matchCandidateDispositionEnum,
  matchCandidateSchema,
  matchListFilterSchema,
  matchRankedListSchema,
  matchRunCreateInputSchema,
  matchRunSchema,
  matchRunStatusEnum,
  scoreBreakdownSchema,
  shortlistSchema,
} from './matching';
export type {
  ApprovalGrantInput,
  ApprovalRejectInput,
  ApprovalRequestInput,
  GateVerdictRecord,
  Outreach,
  OutreachApprovalStatus,
  OutreachComposeInput,
  OutreachStatus,
  OutreachTemplate,
  OutreachTemplateVersion,
  TemplateCreateInput,
  VersionDraftInput,
} from './outreach';
export {
  approvalGrantInputSchema,
  approvalRejectInputSchema,
  approvalRequestInputSchema,
  gateVerdictRecordSchema,
  outreachApprovalStatusEnum,
  outreachComposeInputSchema,
  outreachSchema,
  outreachStatusEnum,
  outreachTemplateSchema,
  outreachTemplateVersionSchema,
  templateCreateInputSchema,
  versionDraftInputSchema,
} from './outreach';
export type {
  AddNoteInput,
  EnrollInput,
  Pipeline,
  PipelineBoard,
  PipelineEvent,
  PipelineEventsResponse,
  PipelineEventType,
  PipelineStage,
  TransitionInput,
} from './pipeline';
export {
  addNoteInputSchema,
  enrollInputSchema,
  pipelineBoardSchema,
  pipelineEventSchema,
  pipelineEventsResponseSchema,
  pipelineEventTypeEnum,
  pipelineSchema,
  pipelineStageEnum,
  transitionInputSchema,
} from './pipeline';
export type { NavGroup, NavItem, RouteEntry } from './rbac';
export {
  ALL_NAV_ITEMS,
  canAccess,
  isPublicRoute,
  navItemsForRole,
  roleRoutes,
  rolesForRoute,
} from './rbac';
export type {
  AuditLogEntryRead,
  ExportManifest,
  ExportScope,
  ListFilter,
} from './recordkeeping';
export {
  auditLogEntryReadSchema,
  exportManifestSchema,
  exportScopeSchema,
  listFilterSchema,
} from './recordkeeping';
export type { ResolveUserWorkspaceResult } from './resolver-contract';
export { resolveUserWorkspaceResultSchema } from './resolver-contract';
// auditVerifyResponseSchema is also re-exported from recordkeeping (do NOT
// import it from there — import from ./audit directly to avoid double re-export
// confusion; recordkeeping re-exports it for co-location convenience only).
export type {
  CompaniesListFilter,
  Company,
  CompanyProvenance,
  ConnectionCreateInput,
  Contact,
  ContactProvenance,
  DataSourceAdapter,
  DataSourceConnection,
  DataSourceConnectionRecord,
  DedupeCandidate,
  DedupeCandidateStatus,
  DedupeResolveInput,
  NormalizedContact,
  NormalizedSourceRecord,
  SyncSummary,
} from './sourcing';
export {
  companiesListFilterSchema,
  companyProvenanceSchema,
  companySchema,
  connectionCreateSchema,
  contactProvenanceSchema,
  contactSchema,
  dataSourceConnectionSchema,
  dedupeCandidateSchema,
  dedupeCandidateStatusEnum,
  dedupeResolveInputSchema,
  normalizedContactSchema,
  normalizedSourceRecordSchema,
  syncSummarySchema,
} from './sourcing';
// --- Wave-15 admin contracts ---
export type {
  AdminAssignRoleInput,
  AdminDeactivateResponse,
  AdminInviteInput,
  AdminInviteResponse,
  AdminReactivateParams,
  AdminReactivateResponse,
  UserAdminListResponse,
  UserAdminRecord,
} from './user-admin';
export {
  adminAssignRoleInputSchema,
  adminDeactivateResponseSchema,
  adminInviteInputSchema,
  adminInviteResponseSchema,
  adminReactivateParamsSchema,
  adminReactivateResponseSchema,
  userAdminListResponseSchema,
  userAdminRecordSchema,
} from './user-admin';
// --- Wave-17 workspace isolation contracts (tasks 0db154ff / 96026365) ---
export type { Workspace, WorkspaceId } from './workspace';
export {
  DEFAULT_WORKSPACE_ID,
  workspaceIdSchema,
  workspaceSchema,
} from './workspace';
export type {
  WorkspaceSettings,
  WorkspaceSettingsUpdateInput,
} from './workspace-settings';
export {
  workspaceSettingsSchema,
  workspaceSettingsUpdateSchema,
} from './workspace-settings';
