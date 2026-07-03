import { z } from 'zod';

/**
 * Compliance summary response — the enforced-RBAC exemplar endpoint's payload
 * (GET /compliance/summary). Wave-3 M1 slice: a role-appropriate LANDING
 * shell, NOT feature content. `items` is intentionally an empty landing list
 * this wave; feature content (the compliance queue) lands in a later milestone.
 */
export const complianceSummaryResponseSchema = z.object({
  pendingCount: z.number().int().nonnegative(),
  items: z.array(z.unknown()),
});

export type ComplianceSummaryResponse = z.infer<typeof complianceSummaryResponseSchema>;
