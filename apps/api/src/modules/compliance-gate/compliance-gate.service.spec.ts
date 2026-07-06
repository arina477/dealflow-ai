/**
 * T-8 Security unit — ComplianceGateService (wave-5, tasks 0595a835 / 95adac6c /
 * 034463b1 + P-4 SoD-strictness remediation).
 *
 * The gate is the SOLE, non-bypassable send-eligibility authority. These tests
 * pin the security invariants with NO live DB (fake repo modelling the config
 * tables + fake AuditService recording appends), matching the wave-2/3/4 mock
 * discipline (audit.service.spec.ts).
 *
 * Coverage:
 *   (a) evaluate() runs ALL evaluators every call + writes the gate-evaluate
 *       audit entry; no reachable skip path.
 *   (b) audit-append-fail → evaluate() throws → tx rolls back (no verdict without
 *       audit).
 *   (c) SoD compliance-only matrix (the compliance-critical test):
 *       compliance-approved → allowed; admin approver → BLOCKED (sod);
 *       advisor approver → blocked; sender==approver → blocked; no row → blocked
 *       (no-approval).
 *   (d) suppression exact + domain match → block.
 *   (e) disclaimer missing → block; present → pass.
 *   (f) content-hash mismatch (edited content) → block; match → pass.
 */

import type { AuditEntryInput, GateContext } from '@dealflow/shared';
import { gateVerdictSchema } from '@dealflow/shared';
import { describe, expect, it, vi } from 'vitest';

import type { Tx } from '../audit/audit.repository';
import type { AuditService } from '../audit/audit.service';
import type {
  ActiveDisclaimerRow,
  ApprovalRow,
  ComplianceGateRepository,
  SuppressionRow,
} from './compliance-gate.repository';
import { ComplianceGateService } from './compliance-gate.service';
import { computeContentHash } from './content-hash';
import { suppressionEvaluator } from './evaluators/suppression.evaluator';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SENDER = '11111111-1111-4111-8111-111111111111';
const APPROVER = '22222222-2222-4222-8222-222222222222';
const CONTENT = 'Hello — this is compliant outreach.';
const CONTENT_HASH = computeContentHash(CONTENT);

function baseCtx(overrides: Partial<GateContext> = {}): GateContext {
  return {
    senderUserId: SENDER,
    senderRole: 'advisor',
    recipients: ['prospect@example.com'],
    jurisdiction: 'US',
    content: CONTENT,
    contentHash: CONTENT_HASH,
    resourceType: 'outreach',
    resourceId: 'batch-1',
    // Wave-14 (487b0f0c): mandateId is now required in GateContext.
    // It is hash-excluded — recorded in the mandate_id column, not the HMAC preimage.
    mandateId: 'aaaaaaaa-0000-4000-8000-000000000001',
    ...overrides,
  };
}

/** A valid compliance approval bound to CONTENT_HASH (the happy SoD path). */
function validApproval(overrides: Partial<ApprovalRow> = {}): ApprovalRow {
  return {
    contentHash: CONTENT_HASH,
    approverUserId: APPROVER,
    approverRole: 'compliance',
    status: 'approved',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

/** In-memory config-table repo. Records which read methods the gate invoked. */
class FakeRepo {
  suppression: SuppressionRow[] = [];
  disclaimer: ActiveDisclaimerRow | null = null;
  approval: ApprovalRow | null = null;

  calls = { suppression: 0, disclaimer: 0, approval: 0, tx: 0 };

  loadSuppressionEntries = vi.fn(async (_tx: Tx) => {
    this.calls.suppression += 1;
    return this.suppression;
  });

  loadActiveDisclaimer = vi.fn(async (_tx: Tx, _j: string) => {
    this.calls.disclaimer += 1;
    return this.disclaimer;
  });

  loadApproval = vi.fn(async (_tx: Tx, _rt: string, _rid: string) => {
    this.calls.approval += 1;
    return this.approval;
  });

  runInTransaction = vi.fn(async <T>(work: (tx: Tx) => Promise<T>) => {
    this.calls.tx += 1;
    return work({ __fake: true } as unknown as Tx);
  });
}

/** Audit spy: records every append; can be told to throw (rollback test). */
class FakeAudit {
  appended: AuditEntryInput[] = [];
  appendedMandateIds: (string | null)[] = [];
  shouldThrow = false;

  append = vi.fn(async (input: AuditEntryInput, _tx: Tx) => {
    if (this.shouldThrow) {
      throw new Error('audit append failed — chain would not verify');
    }
    this.appended.push(input);
    this.appendedMandateIds.push(null);
    return {} as never;
  });

  /**
   * Wave-14 (487b0f0c) — stub for appendWithMandate. Behaves identically to
   * append() in the fake but records the mandateId for assertions.
   * The real implementation writes mandateId to the hash-excluded column;
   * this stub records it in appendedMandateIds for spec assertions.
   */
  appendWithMandate = vi.fn(async (input: AuditEntryInput, _tx: Tx, mandateId: string) => {
    if (this.shouldThrow) {
      throw new Error('audit append failed — chain would not verify');
    }
    this.appended.push(input);
    this.appendedMandateIds.push(mandateId);
    return {} as never;
  });
}

function makeService(repo: FakeRepo, audit: FakeAudit): ComplianceGateService {
  return new ComplianceGateService(
    audit as unknown as AuditService,
    repo as unknown as ComplianceGateRepository
  );
}

const TX = { __fake: true } as unknown as Tx;

// ---------------------------------------------------------------------------
// (a) All evaluators run every call + audit written; no skip path
// ---------------------------------------------------------------------------

describe('(a) non-bypassability: all evaluators + audit every call', () => {
  it('runs all four evaluator reads and writes exactly one gate-evaluate audit entry', async () => {
    const repo = new FakeRepo();
    repo.approval = validApproval();
    const audit = new FakeAudit();
    const svc = makeService(repo, audit);

    const verdict = await svc.evaluate(baseCtx(), TX);

    // suppression + disclaimer read once; approval read by BOTH sod +
    // content-hash evaluators (two reads) — all four evaluators executed.
    expect(repo.calls.suppression).toBe(1);
    expect(repo.calls.disclaimer).toBe(1);
    expect(repo.calls.approval).toBe(2);

    // Exactly one audit append (via appendWithMandate — wave-14 487b0f0c),
    // action gate-evaluate, in the same tx. The mandateId is from baseCtx().
    expect(audit.appendWithMandate).toHaveBeenCalledOnce();
    expect(audit.appended[0]?.action).toBe('gate-evaluate');
    // appendWithMandate(input, tx, mandateId) — tx is arg[1], mandateId is arg[2]
    expect(audit.appendWithMandate.mock.calls[0]?.[1]).toBe(TX);
    expect(audit.appendWithMandate.mock.calls[0]?.[2]).toBe('aaaaaaaa-0000-4000-8000-000000000001');
    // audit.append is NOT called (gate uses appendWithMandate)
    expect(audit.append).not.toHaveBeenCalled();

    // allow-with-no-rules + valid approval → allowed, schema-valid.
    expect(verdict.allowed).toBe(true);
    expect(gateVerdictSchema.safeParse(verdict).success).toBe(true);
  });

  it('has NO skip param: evaluate() signature is (ctx, tx) only', () => {
    // ComplianceGateService.evaluate.length counts declared params before any
    // default/rest — asserts there is no third "options/skip" parameter.
    expect(ComplianceGateService.prototype.evaluate.length).toBe(2);
  });

  it('default posture: zero rules → allowed:true but still audited', async () => {
    const repo = new FakeRepo(); // no suppression, no disclaimer, no approval...
    // ...but with no approval SoD would block. To isolate the allow-with-no-rules
    // posture of the OTHER evaluators, give a valid approval so only "no other
    // rules" remains.
    repo.approval = validApproval();
    const audit = new FakeAudit();
    const svc = makeService(repo, audit);

    const verdict = await svc.evaluate(baseCtx(), TX);

    expect(verdict.allowed).toBe(true);
    expect(verdict.blocks).toEqual([]);
    // Gate uses appendWithMandate (wave-14 487b0f0c) — append is never called.
    expect(audit.appendWithMandate).toHaveBeenCalledOnce();
    expect(audit.append).not.toHaveBeenCalled();
  });

  it('evaluateStandalone opens its own tx and audits', async () => {
    const repo = new FakeRepo();
    repo.approval = validApproval();
    const audit = new FakeAudit();
    const svc = makeService(repo, audit);

    const verdict = await svc.evaluateStandalone(baseCtx());

    expect(repo.calls.tx).toBe(1);
    expect(verdict.allowed).toBe(true);
    // Gate uses appendWithMandate (wave-14 487b0f0c) — append is never called.
    expect(audit.appendWithMandate).toHaveBeenCalledOnce();
    expect(audit.append).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// (b) audit-append-fail → throw → rollback (no verdict without audit)
// ---------------------------------------------------------------------------

describe('(b) mandatory in-tx audit: append fail rolls back, no verdict', () => {
  it('throws (no verdict returned) when AuditService.append throws', async () => {
    const repo = new FakeRepo();
    repo.approval = validApproval();
    const audit = new FakeAudit();
    audit.shouldThrow = true;
    const svc = makeService(repo, audit);

    await expect(svc.evaluate(baseCtx(), TX)).rejects.toThrow(/audit append failed/);
    // No verdict recorded — the throw propagates so the caller's tx rolls back.
    expect(audit.appended).toHaveLength(0);
  });

  it('evaluateStandalone propagates the audit failure through its tx', async () => {
    const repo = new FakeRepo();
    repo.approval = validApproval();
    const audit = new FakeAudit();
    audit.shouldThrow = true;
    const svc = makeService(repo, audit);

    await expect(svc.evaluateStandalone(baseCtx())).rejects.toThrow(/audit append failed/);
  });
});

// ---------------------------------------------------------------------------
// (c) SoD compliance-ONLY matrix — the compliance-critical test
// ---------------------------------------------------------------------------

describe('(c) SoD compliance-only matrix', () => {
  async function verdictFor(approval: ApprovalRow | null, ctx = baseCtx()) {
    const repo = new FakeRepo();
    repo.approval = approval;
    const audit = new FakeAudit();
    const svc = makeService(repo, audit);
    return { verdict: await svc.evaluate(ctx, TX), audit };
  }

  it('approver=compliance, sender≠approver, approved → ALLOWED', async () => {
    const { verdict, audit } = await verdictFor(validApproval());
    expect(verdict.allowed).toBe(true);
    expect(verdict.blocks).toEqual([]);
    expect(audit.appendWithMandate).toHaveBeenCalledOnce(); // decision still audited (wave-14: via appendWithMandate)
  });

  it('approver=admin → BLOCKED (sod / invalid-approver-role) — no super-role shortcut', async () => {
    const { verdict } = await verdictFor(validApproval({ approverRole: 'admin' }));
    expect(verdict.allowed).toBe(false);
    const sod = verdict.blocks.find((b) => b.code === 'sod');
    expect(sod).toBeDefined();
    expect(sod && sod.code === 'sod' && sod.reason).toBe('invalid-approver-role');
  });

  it('approver=advisor → BLOCKED (sod / invalid-approver-role)', async () => {
    const { verdict } = await verdictFor(validApproval({ approverRole: 'advisor' }));
    expect(verdict.allowed).toBe(false);
    const sod = verdict.blocks.find((b) => b.code === 'sod');
    expect(sod && sod.code === 'sod' && sod.reason).toBe('invalid-approver-role');
  });

  it('approver=analyst → BLOCKED (sod / invalid-approver-role)', async () => {
    const { verdict } = await verdictFor(validApproval({ approverRole: 'analyst' }));
    expect(verdict.allowed).toBe(false);
    const sod = verdict.blocks.find((b) => b.code === 'sod');
    expect(sod && sod.code === 'sod' && sod.reason).toBe('invalid-approver-role');
  });

  it('sender == approver (self-approval) → BLOCKED (sod / sender-is-approver)', async () => {
    const { verdict } = await verdictFor(
      validApproval({ approverUserId: SENDER }) // approver IS the sender
    );
    expect(verdict.allowed).toBe(false);
    const sod = verdict.blocks.find((b) => b.code === 'sod');
    expect(sod && sod.code === 'sod' && sod.reason).toBe('sender-is-approver');
  });

  it('no approval row → BLOCKED (no-approval)', async () => {
    const { verdict } = await verdictFor(null);
    expect(verdict.allowed).toBe(false);
    expect(verdict.blocks.some((b) => b.code === 'no-approval')).toBe(true);
  });

  it('revoked approval → BLOCKED (sod / approval-revoked)', async () => {
    const { verdict } = await verdictFor(validApproval({ status: 'revoked' }));
    expect(verdict.allowed).toBe(false);
    const sod = verdict.blocks.find((b) => b.code === 'sod');
    expect(sod && sod.code === 'sod' && sod.reason).toBe('approval-revoked');
  });

  // CRITICAL-1: fail-closed on a NULL approver (approver account deleted, FK
  // SET-NULL). Such a row can no longer prove sender ≠ approver, so it must NOT
  // satisfy SoD — even when the snapshot role is compliance and the (null)
  // approver is not literally equal to the sender.
  it('approved compliance approval with approverUserId=null → BLOCKED (sod / approver-unknown)', async () => {
    const { verdict } = await verdictFor(
      validApproval({ approverUserId: null, approverRole: 'compliance', status: 'approved' })
    );
    expect(verdict.allowed).toBe(false);
    const sod = verdict.blocks.find((b) => b.code === 'sod');
    expect(sod).toBeDefined();
    expect(sod && sod.code === 'sod' && sod.reason).toBe('approver-unknown');
  });

  it('a CONCRETE compliance approver ≠ sender is still ALLOWED (regression)', async () => {
    const { verdict } = await verdictFor(
      validApproval({ approverUserId: APPROVER, approverRole: 'compliance' })
    );
    expect(verdict.allowed).toBe(true);
    expect(verdict.blocks).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// (d) suppression exact + domain match
// ---------------------------------------------------------------------------

describe('(d) suppression hard-block', () => {
  it('exact email match → block', async () => {
    const repo = new FakeRepo();
    repo.approval = validApproval();
    repo.suppression = [{ matchType: 'email', value: 'prospect@example.com' }];
    const svc = makeService(repo, new FakeAudit());

    const verdict = await svc.evaluate(baseCtx(), TX);
    expect(verdict.allowed).toBe(false);
    const hit = verdict.blocks.find((b) => b.code === 'suppression');
    expect(hit && hit.code === 'suppression' && hit.matchType).toBe('email');
  });

  it('domain-suffix match (subdomain) → block', async () => {
    const repo = new FakeRepo();
    repo.approval = validApproval();
    repo.suppression = [{ matchType: 'domain', value: 'example.com' }];
    const svc = makeService(repo, new FakeAudit());

    const verdict = await svc.evaluate(baseCtx({ recipients: ['someone@mail.example.com'] }), TX);
    expect(verdict.allowed).toBe(false);
    const hit = verdict.blocks.find((b) => b.code === 'suppression');
    expect(hit && hit.code === 'suppression' && hit.matchType).toBe('domain');
  });

  it('non-matching domain (xexample.com) → NOT blocked by suffix', async () => {
    const repo = new FakeRepo();
    repo.approval = validApproval();
    repo.suppression = [{ matchType: 'domain', value: 'example.com' }];
    const svc = makeService(repo, new FakeAudit());

    const verdict = await svc.evaluate(baseCtx({ recipients: ['someone@xexample.com'] }), TX);
    expect(verdict.blocks.some((b) => b.code === 'suppression')).toBe(false);
    expect(verdict.allowed).toBe(true);
  });

  // INFO: recipient normalization — a suppressed address with mixed-case still
  // hits exact suppression through the full service path (schema-valid input).
  it('normalized match: mixed-case recipient still hits exact suppression', async () => {
    const repo = new FakeRepo();
    repo.approval = validApproval();
    repo.suppression = [{ matchType: 'email', value: 'prospect@example.com' }];
    const svc = makeService(repo, new FakeAudit());

    const verdict = await svc.evaluate(baseCtx({ recipients: ['Prospect@Example.com'] }), TX);
    expect(verdict.allowed).toBe(false);
    const hit = verdict.blocks.find((b) => b.code === 'suppression');
    expect(hit && hit.code === 'suppression' && hit.matchType).toBe('email');
  });
});

// ---------------------------------------------------------------------------
// (d2) suppression recipient NORMALIZATION — matcher self-defense, tested at the
// evaluator level (the trailing-dot / whitespace forms don't survive the
// service-level gateContextSchema.parse, but the matcher must still normalize so
// it is safe regardless of entry point).
// ---------------------------------------------------------------------------

describe('(d2) suppression evaluator normalizes recipients', () => {
  function fakeRepoWith(suppression: SuppressionRow[]): ComplianceGateRepository {
    return {
      loadSuppressionEntries: async (_tx: Tx) => suppression,
    } as unknown as ComplianceGateRepository;
  }

  it('trailing-dot (FQDN root) recipient still hits exact suppression', async () => {
    const repo = fakeRepoWith([{ matchType: 'email', value: 'prospect@example.com' }]);
    const result = await suppressionEvaluator(
      { recipients: ['prospect@example.com.'] } as unknown as GateContext,
      repo,
      TX
    );
    expect(result.blocks.some((b) => b.code === 'suppression')).toBe(true);
  });

  it('surrounding whitespace + mixed case still hits exact suppression', async () => {
    const repo = fakeRepoWith([{ matchType: 'email', value: 'prospect@example.com' }]);
    const result = await suppressionEvaluator(
      { recipients: ['  Prospect@Example.COM  '] } as unknown as GateContext,
      repo,
      TX
    );
    expect(result.blocks.some((b) => b.code === 'suppression')).toBe(true);
  });

  it('trailing-dot recipient still hits domain-suffix suppression', async () => {
    const repo = fakeRepoWith([{ matchType: 'domain', value: 'example.com' }]);
    const result = await suppressionEvaluator(
      { recipients: ['someone@mail.example.com.'] } as unknown as GateContext,
      repo,
      TX
    );
    const hit = result.blocks.find((b) => b.code === 'suppression');
    expect(hit && hit.code === 'suppression' && hit.matchType).toBe('domain');
  });
});

// ---------------------------------------------------------------------------
// (g) CRITICAL-3 — fail-closed ctx validation (gateContextSchema.parse first)
// ---------------------------------------------------------------------------

describe('(g) fail-closed input validation: evaluate() parses ctx', () => {
  it('non-email recipient → evaluate() THROWS (does not silently allow)', async () => {
    const repo = new FakeRepo();
    repo.approval = validApproval();
    const svc = makeService(repo, new FakeAudit());

    // 'not-an-email' fails gateContextSchema (recipients must be emails).
    const badCtx = { ...baseCtx(), recipients: ['not-an-email'] } as GateContext;
    await expect(svc.evaluate(badCtx, TX)).rejects.toThrow();
    // Evaluators never ran (parse throws first) → no suppression read.
    expect(repo.calls.suppression).toBe(0);
  });

  it('empty content → evaluate() THROWS', async () => {
    const repo = new FakeRepo();
    repo.approval = validApproval();
    const svc = makeService(repo, new FakeAudit());

    const badCtx = { ...baseCtx(), content: '' } as GateContext;
    await expect(svc.evaluate(badCtx, TX)).rejects.toThrow();
  });

  it('evaluateStandalone also fails closed on invalid ctx', async () => {
    const repo = new FakeRepo();
    repo.approval = validApproval();
    const svc = makeService(repo, new FakeAudit());

    const badCtx = { ...baseCtx(), recipients: ['nope'] } as GateContext;
    await expect(svc.evaluateStandalone(badCtx)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// (e) disclaimer enforcement
// ---------------------------------------------------------------------------

describe('(e) disclaimer enforcement', () => {
  const template: ActiveDisclaimerRow = {
    id: '33333333-3333-4333-8333-333333333333',
    jurisdiction: 'US',
    body: 'This is not investment advice.',
    version: 2,
  };

  it('required disclaimer missing → block + requiredDisclaimers populated', async () => {
    const repo = new FakeRepo();
    repo.approval = validApproval();
    repo.disclaimer = template;
    const svc = makeService(repo, new FakeAudit());

    const verdict = await svc.evaluate(baseCtx(), TX); // CONTENT lacks the body
    expect(verdict.allowed).toBe(false);
    const miss = verdict.blocks.find((b) => b.code === 'missing-disclaimer');
    expect(miss && miss.code === 'missing-disclaimer' && miss.disclaimerTemplateId).toBe(
      template.id
    );
    expect(verdict.requiredDisclaimers).toContain(template.id);
  });

  it('disclaimer present in content → pass', async () => {
    const repo = new FakeRepo();
    const contentWithDisclaimer = `${CONTENT}\n\n${template.body}`;
    // approval must bind the NEW content hash, else content-hash evaluator blocks.
    repo.approval = validApproval({ contentHash: computeContentHash(contentWithDisclaimer) });
    repo.disclaimer = template;
    const svc = makeService(repo, new FakeAudit());

    const verdict = await svc.evaluate(baseCtx({ content: contentWithDisclaimer }), TX);
    expect(verdict.blocks.some((b) => b.code === 'missing-disclaimer')).toBe(false);
    expect(verdict.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (f) content-hash binding
// ---------------------------------------------------------------------------

describe('(f) content-hash binding', () => {
  it('content edited after approval (hash mismatch) → block', async () => {
    const repo = new FakeRepo();
    // Approval bound to the ORIGINAL content hash...
    repo.approval = validApproval({ contentHash: CONTENT_HASH });
    const svc = makeService(repo, new FakeAudit());

    // ...but the ctx content has been edited → recomputed hash differs.
    const verdict = await svc.evaluate(baseCtx({ content: `${CONTENT} EDITED` }), TX);
    expect(verdict.allowed).toBe(false);
    const mm = verdict.blocks.find((b) => b.code === 'content-hash-mismatch');
    expect(mm).toBeDefined();
    expect(mm && mm.code === 'content-hash-mismatch' && mm.approvedHash).toBe(CONTENT_HASH);
  });

  it('content matches approved hash → pass', async () => {
    const repo = new FakeRepo();
    repo.approval = validApproval({ contentHash: CONTENT_HASH });
    const svc = makeService(repo, new FakeAudit());

    const verdict = await svc.evaluate(baseCtx(), TX);
    expect(verdict.blocks.some((b) => b.code === 'content-hash-mismatch')).toBe(false);
    expect(verdict.allowed).toBe(true);
  });

  it('canonicalization: trailing-whitespace / CRLF variants hash identically', () => {
    expect(computeContentHash('body')).toBe(computeContentHash('body\n'));
    expect(computeContentHash('a\r\nb')).toBe(computeContentHash('a\nb'));
    expect(computeContentHash('  body  ')).toBe(computeContentHash('body'));
  });
});
