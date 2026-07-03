/**
 * T-2 Unit — ComplianceService
 *
 * Asserts the exemplar returns the empty LANDING shell (M1 slice: no feature
 * content) and that the payload validates against the shared response schema.
 */

import { complianceSummaryResponseSchema } from '@dealflow/shared';
import { describe, expect, it } from 'vitest';

import { ComplianceService } from './compliance.service';

describe('ComplianceService', () => {
  it('returns the empty landing shell {pendingCount:0, items:[]}', () => {
    const service = new ComplianceService();
    const result = service.getSummary();

    expect(result.pendingCount).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('payload validates against complianceSummaryResponseSchema', () => {
    const service = new ComplianceService();
    const parsed = complianceSummaryResponseSchema.safeParse(service.getSummary());
    expect(parsed.success).toBe(true);
  });
});
