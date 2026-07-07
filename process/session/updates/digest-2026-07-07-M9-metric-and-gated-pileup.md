# For your review — DealFlow AI (2026-07-07)

Two things to flag as we keep building. **Neither blocks work — the loop is continuing on buildable features.** These are decisions only you can make.

---

## 1. One number to lock in for the "Integrations & insight" milestone

We've now shipped both insight halves of this milestone: the **advisor analytics dashboard** (mandate throughput, response/productivity views) and the **match-quality feedback view** (how your accept/reject choices calibrate the scoring). What's still missing is *your* definition of success for the whole milestone — the target we'd measure it against.

Right now that target reads "to be decided." Our proposed wording:

> *Advisors sync to their existing CRM and can see response-rate and throughput analytics — target: [a number you pick, e.g. "80% of active advisors check insights weekly" or "median mandate response rate visible within 2 clicks"].*

**What we need from you:** the concrete number/threshold that means "this milestone did its job." We can't close the milestone as "done" until it's set. Not urgent — we'll keep building the remaining features meanwhile.

---

## 2. Four features are waiting on a decision or account from you

These are ready to build the moment you unblock them. Each needs either a paid service choice or an account login we can't create ourselves:

| Feature area | What's blocking it | What we need |
|---|---|---|
| Real deal-source / CRM connections (Salesforce, DealCloud, Affinity) | Which vendor, plus a paid plan + API key | Pick a provider and share account access |
| AI-powered buyer-seller matching | Ongoing AI usage cost | Approve a spend budget |
| Sending real outreach emails | Email provider + domain-sending setup | Choose an email service and confirm the sending domain |
| Outreach sending domain (admin leg) | Same email/domain setup as above | (bundled with the email decision) |

**Recommendation:** the two highest-leverage unlocks are (a) the **AI matching spend approval** and (b) the **CRM/deal-source vendor pick** — those open the most product value. The outreach email pieces can follow.

Until you weigh in, we'll keep shipping features that need none of the above — this week we're building an **internal outreach-activity tracker** (log your calls/emails/LinkedIn touches as tasks, no external sending required).

---

*Related detail already on file: `founder-decision-llm-matching-spend.md`, `founder-decision-m6-send-credential.md`.*
