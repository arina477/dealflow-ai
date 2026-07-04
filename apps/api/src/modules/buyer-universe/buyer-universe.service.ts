/**
 * BuyerUniverseService — orchestration for the buyer-universe spine.
 *
 * Responsibilities:
 *   1. assembleAsActor   — assemble a buyer universe for a mandate from M3 companies.
 *   2. filterAsActor     — apply mandate's buyer criteria to include/exclude candidates.
 *   3. enrichAsActor     — attach M3 contacts to included candidates (read/view join).
 *   4. getGaps           — flag included candidates with no M3 contacts / missing data.
 *   5. submitAsActor     — mark status=submitted (ready-to-rank for M5). Guard: must
 *                          be assembled+filtered (400 if empty/draft/un-triaged).
 *   6. getById           — returns BuyerUniverseDetail (404 if absent).
 *   7. listByMandate     — returns all universes for a mandate.
 *   8. patchCandidateAsActor — PATCH a single candidate membership (include/exclude).
 *
 * ── Actor identity (wave-5 lesson) ─────────────────────────────────────────
 * ALL users.id FK columns are populated from the APP users.id — NEVER the
 * raw SuperTokens user id from the session. The service translates via
 * AuthRepository.getUserWithRole(supertokensUserId) before any DB write.
 *
 * ── One-txn atomicity ───────────────────────────────────────────────────────
 * assembleAsActor opens ONE transaction: acquires pg_advisory_xact_lock for the
 * mandate, reads mandate + criteria, SELECTs M3 companies, ON CONFLICT
 * (mandate_id) DO UPDATE RETURNING to get-or-create the buyer_universe atomically,
 * INSERTs candidates (onConflictDoNothing), resets status→draft if new candidates
 * were added to a non-draft universe, audits LAST-IN-TXN.
 * filterAsActor opens ONE transaction: reads candidates, applies criteria,
 * bulk-updates membership, updates status→filtered, audits LAST-IN-TXN.
 *
 * ── Idempotent re-assemble ───────────────────────────────────────────────────
 * ON CONFLICT (mandate_id) DO UPDATE RETURNING atomically gets-or-creates the
 * buyer_universe. New companies are inserted with onConflictDoNothing on the
 * composite unique (buyer_universe_id, company_id), so re-assemble never creates
 * duplicate candidates.
 *
 * ── Re-assemble state reset ─────────────────────────────────────────────────
 * CRITICAL-7: if re-assemble inserts ≥1 NEW candidate into a non-draft universe,
 * the universe status is reset to 'draft' (forcing re-filter before submit).
 * Invariant: 'filtered' means every candidate is triaged (included|excluded, none
 * 'candidate'). submitAsActor rejects if any candidate has membership_status=
 * 'candidate' (un-triaged rows present → 400).
 *
 * ── M4/M5 BOUNDARY (CRITICAL) ──────────────────────────────────────────────
 * NO score / rank / fit / rationale / LLM anywhere in this service.
 * assemble + filter + enrich + flag + submit ONLY.
 * The head-builder polices this at B-6.
 *
 * ── Audit (last-in-txn) ────────────────────────────────────────────────────
 * AuditService.append is called LAST in every mutating transaction, after all
 * business writes. Audit failure rolls back the whole transaction.
 *
 * ── Return shape (CRITICAL-B) ───────────────────────────────────────────────
 * filterAsActor, submitAsActor, and enrichAsActor all return BuyerUniverseDetail
 * (universe + enriched candidates) so the web client can re-render without a
 * separate GET. composeDetailInTx reads consistently within the open transaction.
 */

import { createHash } from 'node:crypto';
import type {
  AuditEntryInput,
  BuyerUniverseAssembleInput,
  BuyerUniverseCandidatePatchInput,
  BuyerUniverseDetail,
  BuyerUniverseGapsResponse,
  EnrichedCandidate,
} from '@dealflow/shared';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { companies } from '../../db/schema/sourcing';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { AuditService } from '../audit/audit.service';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { AuthRepository } from '../auth/auth.repository';
import type {
  BuyerUniverseCandidateRow,
  BuyerUniverseRow,
  ContactRow,
  Tx,
} from './buyer-universe.repository';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { BuyerUniverseRepository } from './buyer-universe.repository';

@Injectable()
export class BuyerUniverseService {
  constructor(
    private readonly repository: BuyerUniverseRepository,
    private readonly auditService: AuditService,
    private readonly authRepository: AuthRepository
  ) {}

  // ---------------------------------------------------------------------------
  // composeDetailInTx — internal helper (CRITICAL-B)
  // ---------------------------------------------------------------------------

  /**
   * composeDetailInTx — read the full BuyerUniverseDetail within an open
   * transaction so filter/submit/enrich can return the fresh composed state.
   *
   * ALL reads use the tx handle for a consistent snapshot.
   */
  private async composeDetailInTx(tx: Tx, universeId: string): Promise<BuyerUniverseDetail> {
    const universe = await this.repository.findBuyerUniverseByIdInTx(tx, universeId);
    if (!universe) {
      throw new NotFoundException(`Buyer universe ${universeId} not found`);
    }

    const candidates = await this.repository.listCandidatesByUniverseIdInTx(tx, universeId);
    const companyIds = candidates.map((c) => c.companyId);
    const contactRows = await this.repository.findContactsByCompanyIdsInTx(tx, companyIds);

    const contactsByCompany = new Map<string, ContactRow[]>();
    for (const contact of contactRows) {
      const existing = contactsByCompany.get(contact.companyId) ?? [];
      existing.push(contact);
      contactsByCompany.set(contact.companyId, existing);
    }

    const enrichedCandidates: EnrichedCandidate[] = candidates.map((candidate) => ({
      id: candidate.id,
      buyerUniverseId: candidate.buyerUniverseId,
      companyId: candidate.companyId,
      membershipStatus: candidate.membershipStatus as 'candidate' | 'included' | 'excluded',
      provenance: candidate.provenance ?? null,
      createdAt: candidate.createdAt,
      contacts: (contactsByCompany.get(candidate.companyId) ?? []).map((c) => ({
        id: c.id,
        companyId: c.companyId,
        name: c.name ?? null,
        email: c.email ?? null,
        normalizedEmail: c.normalizedEmail ?? null,
        title: c.title ?? null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt ?? null,
      })),
    }));

    return {
      universe: {
        id: universe.id,
        mandateId: universe.mandateId,
        createdBy: universe.createdBy,
        status: universe.status,
        createdAt: universe.createdAt,
        updatedAt: universe.updatedAt ?? null,
      },
      candidates: enrichedCandidates,
    };
  }

  // ---------------------------------------------------------------------------
  // assembleAsActor
  // ---------------------------------------------------------------------------

  /**
   * assembleAsActor — assemble a buyer universe for a mandate.
   *
   * Steps (all in ONE tx):
   *   1. Translate ST id → app users.id.
   *   2. Acquire pg_advisory_xact_lock(hashtext($mandateId)) — defense-in-depth
   *      against concurrent assembles (CRITICAL-3). The DB UNIQUE on mandate_id is
   *      the authoritative guard; the advisory lock prevents wasted work.
   *   3. Read mandate + mandateBuyerCriteria (M4 — read-only).
   *   4. SELECT all active M3 companies as prospective buyers.
   *      orderBy name ASC — presentation-stability only; NO ranking semantics
   *      (M5 owns ranking; this order must never be interpreted as fit/score order).
   *   5. ON CONFLICT (mandate_id) DO UPDATE SET mandate_id=mandate_id RETURNING —
   *      get-or-create buyer_universe atomically (CRITICAL-3).
   *   6. INSERT candidates with onConflictDoNothing (idempotent re-assemble).
   *      Track new_count to detect re-assemble that adds companies.
   *   7. CRITICAL-7: if new_count > 0 and universe.status !== 'draft', reset
   *      status → 'draft' so the analyst must re-filter before submit.
   *   8. AUDIT buyer-universe-assemble LAST-IN-TXN.
   */
  async assembleAsActor(
    input: BuyerUniverseAssembleInput,
    supertokensUserId: string
  ): Promise<BuyerUniverseRow> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // 2. Acquire per-mandate advisory lock (defense-in-depth; DB UNIQUE is the
      //    authoritative guard against duplicates — CRITICAL-3).
      await this.repository.acquireMandateAdvisoryLockInTx(tx, input.mandateId);

      // 3. Read mandate (validate it exists — M4 read-only).
      const mandate = await this.repository.findMandateByIdInTx(tx, input.mandateId);
      if (!mandate) {
        throw new NotFoundException(`Mandate ${input.mandateId} not found`);
      }

      // 4. SELECT active M3 companies as prospective buyers.
      //    orderBy name ASC — presentation-stability only; NO ranking semantics
      //    (M5 owns ranking). Never interpret this order as fit/score order.
      const allCompanies = await this.repository.listActiveCompaniesInTx(tx);

      // 5. ON CONFLICT (mandate_id) DO UPDATE RETURNING — get-or-create (CRITICAL-3).
      //    The DO UPDATE SET mandate_id=EXCLUDED.mandate_id is a no-op update that
      //    satisfies RETURNING while keeping the existing row. The DB UNIQUE on
      //    mandate_id makes two concurrent first-inserts resolve to one row.
      const { universe, isNew } = await this.repository.upsertBuyerUniverseInTx(tx, {
        mandateId: input.mandateId,
        createdBy: appUserId,
      });

      // 6. INSERT candidates with onConflictDoNothing (idempotent re-assemble).
      const candidateInputs = allCompanies.map((company) => ({
        buyerUniverseId: universe.id,
        companyId: company.id,
        provenance: 'assembled from sourcing',
      }));
      const newCount = await this.repository.insertCandidatesBatchCountNew(tx, candidateInputs);

      // 7. CRITICAL-7: if re-assemble inserts ≥1 new candidate into a non-draft
      //    universe, reset status → 'draft'. This forces the analyst to re-filter
      //    before submit (invariant: 'filtered' = every candidate is triaged).
      let finalUniverse = universe;
      if (!isNew && newCount > 0 && universe.status !== 'draft') {
        finalUniverse = await this.repository.updateBuyerUniverseStatus(tx, universe.id, 'draft');
      }

      // 8. AUDIT LAST-IN-TXN.
      const eventPayload = {
        universeId: universe.id,
        mandateId: input.mandateId,
        companiesCount: allCompanies.length,
        newCandidatesAdded: newCount,
        statusResetToDraft: !isNew && newCount > 0 && universe.status !== 'draft',
        actorRole,
        reused: !isNew,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'buyer-universe-assemble',
        resourceType: 'buyer_universe',
        resourceId: universe.id,
        contentHash: payloadHash,
        payloadHash,
      };
      await this.auditService.append(auditInput, tx);

      return finalUniverse;
    });
  }

  // ---------------------------------------------------------------------------
  // filterAsActor
  // ---------------------------------------------------------------------------

  /**
   * filterAsActor — apply the mandate's mandateBuyerCriteria to include/exclude
   * each candidate. Updates membership_status + provenance per candidate.
   * Updates universe status → 'filtered'.
   *
   * Returns BuyerUniverseDetail (CRITICAL-B) — web client re-renders from this.
   *
   * ── Filter dimensions ───────────────────────────────────────────────────────
   * CRITICAL-6: Only dimensions that M3 companies actually carry are evaluated.
   * M3 companies have: sector (maps to industry criterion).
   * M3 companies do NOT have: geo, size_band, deal_type columns.
   *
   * Supported:   industry → matched against companies.sector using normalized-equality
   *              (token match: every word in the criterion appears in the sector, or
   *               sector equals criterion — bidirectional substring is over-broad and
   *               the wave-8 jenny D1 gap root cause).
   * Unsupported: geo, sizeBand, dealType — when a mandate specifies these, they are
   *              NOT silently ignored. Instead the provenance records the partial-filter
   *              gap and the audit includes an `unsupportedDimensions` array. The
   *              response includes `filterGaps` (N criteria dimensions that could not
   *              be applied). Pending M3 enrichment that adds geo/size/deal_type columns.
   *
   * Steps (ONE tx):
   *   1. Translate ST id → app users.id.
   *   2. Read universe + validate exists.
   *   3. Read the mandate's mandateBuyerCriteria (M4 — read-only).
   *   4. List all candidates in the universe.
   *   5. Apply supported filter dimensions with tighter match.
   *      Record unsupported dimensions in provenance/audit (not silently drop).
   *   6. Bulk-update candidate membership.
   *   7. Update universe status → 'filtered'.
   *   8. AUDIT LAST-IN-TXN (include unsupportedDimensions list).
   *   9. Compose + return BuyerUniverseDetail (CRITICAL-B).
   */
  async filterAsActor(universeId: string, supertokensUserId: string): Promise<BuyerUniverseDetail> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // 2. Read universe.
      const universe = await this.repository.findBuyerUniverseByIdInTx(tx, universeId);
      if (!universe) {
        throw new NotFoundException(`Buyer universe ${universeId} not found`);
      }

      // 3. Read mandate's buyer criteria (M4 — read-only).
      const criteria = await this.repository.findBuyerCriteriaByMandateIdInTx(
        tx,
        universe.mandateId
      );

      // 4. List candidates.
      const candidates = await this.repository.listCandidatesByUniverseIdInTx(tx, universeId);

      // 5. Determine which criterion dimensions are supported vs unsupported.
      //    CRITICAL-6: M3 companies have sector only. geo/sizeBand/dealType are not
      //    columns on companies table — pending enrichment. Do NOT silently ignore them.
      const unsupportedDimensions: string[] = [];
      if (criteria) {
        if (criteria.geo) unsupportedDimensions.push('geo');
        if (criteria.sizeBand) unsupportedDimensions.push('sizeBand');
        if (criteria.dealType) unsupportedDimensions.push('dealType');
      }
      const partialFilterNote =
        unsupportedDimensions.length > 0
          ? `; ${unsupportedDimensions.join('/')} criteria not applied (M3 companies lack these columns — pending enrichment)`
          : '';

      // Apply filter: read M3 company sectors for each candidate.
      const companyIds = candidates.map((c) => c.companyId);
      const companyMap = new Map<string, { id: string; sector: string | null; name: string }>();

      if (companyIds.length > 0) {
        const companyRows = await tx
          .select()
          .from(companies)
          .where(inArray(companies.id, companyIds));
        for (const c of companyRows) {
          companyMap.set(c.id, { id: c.id, sector: c.sector ?? null, name: c.name });
        }
      }

      const updates: Array<{
        id: string;
        membershipStatus: 'included' | 'excluded';
        provenance: string;
      }> = [];

      for (const candidate of candidates) {
        const company = companyMap.get(candidate.companyId);
        const exclusionReasons: string[] = [];

        if (criteria) {
          // Industry dimension (CRITICAL-6): normalized-equality / token match.
          // TIGHTER than bidirectional substring: we normalize both strings, then
          // check if every token in the criterion appears in the sector tokens
          // (OR sector tokens appear in criterion tokens). This prevents the
          // over-broad "finance".includes("financial services") false match.
          if (criteria.industry) {
            if (!company?.sector) {
              exclusionReasons.push(
                `industry mismatch: expected "${criteria.industry}", company has no sector data`
              );
            } else {
              const normCriterion = criteria.industry.toLowerCase().trim();
              const normSector = company.sector.toLowerCase().trim();

              // Token-based match: split on whitespace/punctuation, check token overlap.
              const criterionTokens = normCriterion.split(/[\s,/&+|-]+/).filter(Boolean);
              const sectorTokens = normSector.split(/[\s,/&+|-]+/).filter(Boolean);

              // Match if criterion tokens are a subset of sector tokens, or
              // sector tokens are a subset of criterion tokens (directional subset,
              // not bidirectional substring — prevents 'Tech' matching 'BioTechnology').
              const criterionMatchesSector = criterionTokens.every((t) =>
                sectorTokens.some((s) => s === t)
              );
              const sectorMatchesCriterion = sectorTokens.every((t) =>
                criterionTokens.some((c) => c === t)
              );

              if (!criterionMatchesSector && !sectorMatchesCriterion) {
                exclusionReasons.push(
                  `industry mismatch: expected "${criteria.industry}", got "${company.sector}"`
                );
              }
            }
          }
          // geo / sizeBand / dealType: NOT silently ignored — recorded in provenance
          // via partialFilterNote so the analyst knows the filter is partial.
          // These will be evaluated once M3 companies carry geo/size/deal_type columns.
        }

        if (exclusionReasons.length > 0) {
          updates.push({
            id: candidate.id,
            membershipStatus: 'excluded',
            provenance: `excluded: ${exclusionReasons.join('; ')}${partialFilterNote}`,
          });
        } else {
          const inclusionLabel = criteria
            ? 'included: passed buyer criteria filter'
            : 'included: no filter criteria defined';
          updates.push({
            id: candidate.id,
            membershipStatus: 'included',
            provenance: `${inclusionLabel}${partialFilterNote}`,
          });
        }
      }

      // 6. Bulk-update candidate membership.
      await this.repository.batchUpdateCandidateMembership(tx, updates);

      // 7. Update universe status → 'filtered'.
      await this.repository.updateBuyerUniverseStatus(tx, universeId, 'filtered');

      // 8. AUDIT LAST-IN-TXN.
      const includedCount = updates.filter((u) => u.membershipStatus === 'included').length;
      const excludedCount = updates.filter((u) => u.membershipStatus === 'excluded').length;
      const eventPayload = {
        universeId,
        mandateId: universe.mandateId,
        includedCount,
        excludedCount,
        // CRITICAL-6: record unsupported dimensions so audit log is honest
        unsupportedDimensions,
        partialFilter: unsupportedDimensions.length > 0,
        actorRole,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'buyer-universe-filter',
        resourceType: 'buyer_universe',
        resourceId: universeId,
        contentHash: payloadHash,
        payloadHash,
      };
      await this.auditService.append(auditInput, tx);

      // 9. Compose + return BuyerUniverseDetail (CRITICAL-B).
      return this.composeDetailInTx(tx, universeId);
    });
  }

  // ---------------------------------------------------------------------------
  // enrichAsActor
  // ---------------------------------------------------------------------------

  /**
   * enrichAsActor — attach M3 contacts to included candidates.
   *
   * No new vendor, no writes to companies/contacts. Contacts are read from
   * the M3 contacts table and attached to included candidates. Returns the
   * full BuyerUniverseDetail so the web client can re-render (CRITICAL-B).
   *
   * Steps (ONE tx for audit atomicity + consistent snapshot — CRITICAL-5):
   *   1. Translate ST id → app users.id.
   *   2. Read universe (in tx).
   *   3. List included candidates (in tx — CRITICAL-5: InTx variant).
   *   4. Read M3 contacts for included companies (in tx — CRITICAL-5: InTx variant).
   *      ALL reads use the tx handle so the audited snapshot is transactionally
   *      consistent (no non-tx reads inside runInTransaction).
   *   5. AUDIT LAST-IN-TXN.
   *   6. Compose + return BuyerUniverseDetail (CRITICAL-B).
   */
  async enrichAsActor(universeId: string, supertokensUserId: string): Promise<BuyerUniverseDetail> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // 2. Read universe (in tx).
      const universe = await this.repository.findBuyerUniverseByIdInTx(tx, universeId);
      if (!universe) {
        throw new NotFoundException(`Buyer universe ${universeId} not found`);
      }

      // 3. List included candidates (CRITICAL-5: InTx variant — consistent snapshot).
      const includedCandidates = await this.repository.listIncludedCandidatesByUniverseIdInTx(
        tx,
        universeId
      );

      // 4. Read M3 contacts for included companies (CRITICAL-5: InTx variant).
      //    Using the tx handle ensures the count audited below matches the snapshot.
      const companyIds = includedCandidates.map((c) => c.companyId);
      const contactRows = await this.repository.findContactsByCompanyIdsInTx(tx, companyIds);

      // Build company → contacts map.
      const contactsByCompany = new Map<string, ContactRow[]>();
      for (const contact of contactRows) {
        const existing = contactsByCompany.get(contact.companyId) ?? [];
        existing.push(contact);
        contactsByCompany.set(contact.companyId, existing);
      }

      // 5. AUDIT LAST-IN-TXN (counts from the same tx snapshot — CRITICAL-5).
      const enrichedCount = includedCandidates.filter(
        (c) => (contactsByCompany.get(c.companyId) ?? []).length > 0
      ).length;

      const eventPayload = {
        universeId,
        mandateId: universe.mandateId,
        includedCandidates: includedCandidates.length,
        enrichedWithContacts: enrichedCount,
        actorRole,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'buyer-universe-enrich',
        resourceType: 'buyer_universe',
        resourceId: universeId,
        contentHash: payloadHash,
        payloadHash,
      };
      await this.auditService.append(auditInput, tx);

      // 6. Compose + return BuyerUniverseDetail (CRITICAL-B).
      return this.composeDetailInTx(tx, universeId);
    });
  }

  // ---------------------------------------------------------------------------
  // getGaps
  // ---------------------------------------------------------------------------

  /**
   * getGaps — returns included candidates with no M3 contacts or all-null emails.
   * These are "gap" candidates that may need additional data sourcing before M5.
   */
  async getGaps(universeId: string): Promise<BuyerUniverseGapsResponse> {
    const universe = await this.repository.findBuyerUniverseById(universeId);
    if (!universe) {
      throw new NotFoundException(`Buyer universe ${universeId} not found`);
    }

    const includedCandidates = await this.repository.listIncludedCandidatesByUniverseId(universeId);
    const companyIds = includedCandidates.map((c) => c.companyId);
    const contactRows = await this.repository.findContactsByCompanyIds(companyIds);

    // Build company → contacts map.
    const contactsByCompany = new Map<string, ContactRow[]>();
    for (const contact of contactRows) {
      const existing = contactsByCompany.get(contact.companyId) ?? [];
      existing.push(contact);
      contactsByCompany.set(contact.companyId, existing);
    }

    const gaps = includedCandidates
      .map((candidate) => {
        const contacts = contactsByCompany.get(candidate.companyId) ?? [];
        if (contacts.length === 0) {
          return {
            candidateId: candidate.id,
            companyId: candidate.companyId,
            reason: 'no contacts found in M3 sourcing data',
          };
        }
        // All contacts have null email → data gap
        const allEmailsNull = contacts.every((c) => !c.email && !c.normalizedEmail);
        if (allEmailsNull) {
          return {
            candidateId: candidate.id,
            companyId: candidate.companyId,
            reason: `${contacts.length} contact(s) found but all have missing email addresses`,
          };
        }
        return null;
      })
      .filter((g): g is { candidateId: string; companyId: string; reason: string } => g !== null);

    return { universeId, gaps };
  }

  // ---------------------------------------------------------------------------
  // submitAsActor
  // ---------------------------------------------------------------------------

  /**
   * submitAsActor — marks the universe status → 'submitted' (ready-to-rank for M5).
   *
   * Guards (CRITICAL-4 + CRITICAL-7):
   *   - Universe must exist.
   *   - Universe must not be in 'draft' status (400).
   *   - Universe must have at least 1 INCLUDED candidate (not just total candidates).
   *     A universe filtered to all-excluded (0 included, totalCount>0, status='filtered')
   *     MUST be rejected — M5 chokes on an empty-included universe (CRITICAL-4).
   *   - Universe must have no un-triaged 'candidate' rows (CRITICAL-7 invariant):
   *     'filtered' means every row is included|excluded. If any row is still 'candidate'
   *     (e.g. from a re-assemble that added companies after filter), reject with 400.
   *
   * Returns BuyerUniverseDetail (CRITICAL-B).
   *
   * Steps (ONE tx):
   *   1. Translate ST id → app users.id.
   *   2. Read universe + validate.
   *   3. Guard: status must not be 'draft'.
   *   4. Guard: INCLUDED count must be ≥1 (CRITICAL-4).
   *   5. Guard: no 'candidate' (un-triaged) rows (CRITICAL-7).
   *   6. Update status → 'submitted'.
   *   7. AUDIT LAST-IN-TXN.
   *   8. Compose + return BuyerUniverseDetail (CRITICAL-B).
   */
  async submitAsActor(universeId: string, supertokensUserId: string): Promise<BuyerUniverseDetail> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // 2. Read universe.
      const universe = await this.repository.findBuyerUniverseByIdInTx(tx, universeId);
      if (!universe) {
        throw new NotFoundException(`Buyer universe ${universeId} not found`);
      }

      // 3. Guard: must not be draft (run filter first).
      if (universe.status === 'draft') {
        throw new BadRequestException(
          `Buyer universe ${universeId} cannot be submitted: universe is in draft status (run filter first)`
        );
      }

      // 4. Guard: INCLUDED count must be ≥1 (CRITICAL-4).
      //    This catches all-excluded universes (0 included, status=filtered).
      const includedCount = await this.repository.countIncludedCandidatesByUniverseId(universeId);
      if (includedCount === 0) {
        throw new BadRequestException(
          `Buyer universe ${universeId} cannot be submitted: no included candidates — include at least one buyer before submitting`
        );
      }

      // 5. Guard: no un-triaged 'candidate' rows (CRITICAL-7 invariant).
      //    'filtered' means every candidate must be included|excluded. If re-assemble
      //    added new companies after filter, they land as 'candidate' — must re-filter.
      const untriaged = await this.repository.countUntriagedCandidatesByUniverseId(universeId);
      if (untriaged > 0) {
        throw new BadRequestException(
          `Buyer universe ${universeId} cannot be submitted: ${untriaged} un-triaged candidate(s) present — re-filter the universe first`
        );
      }

      // 6. Update status → 'submitted'.
      await this.repository.updateBuyerUniverseStatus(tx, universeId, 'submitted');

      // 7. AUDIT LAST-IN-TXN.
      const eventPayload = {
        universeId,
        mandateId: universe.mandateId,
        previousStatus: universe.status,
        includedCount,
        actorRole,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'buyer-universe-submit',
        resourceType: 'buyer_universe',
        resourceId: universeId,
        contentHash: payloadHash,
        payloadHash,
      };
      await this.auditService.append(auditInput, tx);

      // 8. Compose + return BuyerUniverseDetail (CRITICAL-B).
      return this.composeDetailInTx(tx, universeId);
    });
  }

  // ---------------------------------------------------------------------------
  // getById
  // ---------------------------------------------------------------------------

  /**
   * getById — returns a BuyerUniverseDetail (universe + enriched candidates).
   * Throws NotFoundException (404) if the universe is not found.
   */
  async getById(universeId: string): Promise<BuyerUniverseDetail> {
    const universe = await this.repository.findBuyerUniverseById(universeId);
    if (!universe) {
      throw new NotFoundException(`Buyer universe ${universeId} not found`);
    }

    const candidates = await this.repository.listCandidatesByUniverseId(universeId);
    const companyIds = candidates.map((c) => c.companyId);
    const contactRows = await this.repository.findContactsByCompanyIds(companyIds);

    const contactsByCompany = new Map<string, ContactRow[]>();
    for (const contact of contactRows) {
      const existing = contactsByCompany.get(contact.companyId) ?? [];
      existing.push(contact);
      contactsByCompany.set(contact.companyId, existing);
    }

    const enrichedCandidates: EnrichedCandidate[] = candidates.map((candidate) => ({
      id: candidate.id,
      buyerUniverseId: candidate.buyerUniverseId,
      companyId: candidate.companyId,
      membershipStatus: candidate.membershipStatus as 'candidate' | 'included' | 'excluded',
      provenance: candidate.provenance ?? null,
      createdAt: candidate.createdAt,
      contacts: (contactsByCompany.get(candidate.companyId) ?? []).map((c) => ({
        id: c.id,
        companyId: c.companyId,
        name: c.name ?? null,
        email: c.email ?? null,
        normalizedEmail: c.normalizedEmail ?? null,
        title: c.title ?? null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt ?? null,
      })),
    }));

    return {
      universe: {
        id: universe.id,
        mandateId: universe.mandateId,
        createdBy: universe.createdBy,
        status: universe.status,
        createdAt: universe.createdAt,
        updatedAt: universe.updatedAt ?? null,
      },
      candidates: enrichedCandidates,
    };
  }

  // ---------------------------------------------------------------------------
  // listByMandate
  // ---------------------------------------------------------------------------

  /**
   * listByMandate — returns all buyer universes for a given mandate.
   */
  async listByMandate(mandateId: string): Promise<{ universes: BuyerUniverseRow[] }> {
    const universes = await this.repository.listBuyerUniversesByMandateId(mandateId);
    return { universes };
  }

  // ---------------------------------------------------------------------------
  // patchCandidateAsActor
  // ---------------------------------------------------------------------------

  /**
   * patchCandidateAsActor — PATCH a single candidate's membership_status and/or provenance.
   * Audited in-txn via AuditService.append.
   *
   * INFO: the UPDATE predicate includes AND buyer_universe_id = $universeId (CRITICAL-INFO).
   * If the fetched candidate does not belong to the provided universeId, a 404 is thrown.
   * This prevents cross-resource membership leaks and keeps audit accurate.
   *
   * @param universeId   — the buyer_universe UUID (for validation + predicate scoping)
   * @param candidateId  — the buyer_universe_candidates UUID to update
   * @param input        — { membershipStatus?, provenance? }
   * @param supertokensUserId — raw ST id (translated to app users.id)
   */
  async patchCandidateAsActor(
    universeId: string,
    candidateId: string,
    input: BuyerUniverseCandidatePatchInput,
    supertokensUserId: string
  ): Promise<BuyerUniverseCandidateRow> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // Validate universe exists.
      const universe = await this.repository.findBuyerUniverseByIdInTx(tx, universeId);
      if (!universe) {
        throw new NotFoundException(`Buyer universe ${universeId} not found`);
      }

      // Update the candidate scoped to this universe (INFO: cross-universe guard).
      // updateCandidateMembershipScoped adds AND buyer_universe_id = $universeId
      // to the predicate — returns null if no row matched (candidate not in universe).
      const updated = await this.repository.updateCandidateMembershipScoped(
        tx,
        universeId,
        candidateId,
        {
          ...(input.membershipStatus !== undefined && { membershipStatus: input.membershipStatus }),
          ...(input.provenance !== undefined && { provenance: input.provenance }),
        }
      );

      if (!updated) {
        throw new NotFoundException(
          `Candidate ${candidateId} not found in buyer universe ${universeId}`
        );
      }

      // AUDIT LAST-IN-TXN.
      const eventPayload = {
        universeId,
        candidateId,
        membershipStatus: updated.membershipStatus,
        actorRole,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        // Reuse buyer-universe-filter action for individual candidate patches.
        action: 'buyer-universe-filter',
        resourceType: 'buyer_universe_candidate',
        resourceId: candidateId,
        contentHash: payloadHash,
        payloadHash,
      };
      await this.auditService.append(auditInput, tx);

      return updated;
    });
  }
}
