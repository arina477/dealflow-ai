import type { ComplianceSummaryResponse } from '@dealflow/shared';
import { Injectable } from '@nestjs/common';

/**
 * ComplianceService (wave-3) — thin service backing the enforced-RBAC exemplar.
 *
 * M1 slice: returns a role-appropriate LANDING shell (empty state), NOT feature
 * content. The compliance queue / audit-log content is a later milestone. The
 * value of this endpoint this wave is that it is a REAL protected surface for
 * the newly-ENFORCED RolesGuard to gate + a per-role 403/200 matrix to test.
 */
@Injectable()
export class ComplianceService {
  getSummary(): ComplianceSummaryResponse {
    // Empty landing state — no feature content this wave.
    return { pendingCount: 0, items: [] };
  }
}
