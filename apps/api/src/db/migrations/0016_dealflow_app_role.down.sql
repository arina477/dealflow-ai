-- Rollback for migration 0016 — dealflow_app non-superuser application role.
-- Drops all grants and then the role itself.
-- NOTE: this rollback should only be run if the app has been reconfigured to
-- connect as the superuser role first — the role cannot be dropped while any
-- session is connected as it.

REVOKE EXECUTE ON FUNCTION public.resolve_user_workspace(text)              FROM dealflow_app;
REVOKE EXECUTE ON FUNCTION public.resolve_invite(text)                      FROM dealflow_app;
REVOKE EXECUTE ON FUNCTION public.read_audit_chain_rls_exempt(bigint, bigint) FROM dealflow_app;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM dealflow_app;

REVOKE ALL ON TABLE public.users                      FROM dealflow_app;
REVOKE ALL ON TABLE public.invites                    FROM dealflow_app;
REVOKE ALL ON TABLE public.audit_log_entries          FROM dealflow_app;
REVOKE ALL ON TABLE public.compliance_rules           FROM dealflow_app;
REVOKE ALL ON TABLE public.suppression_list           FROM dealflow_app;
REVOKE ALL ON TABLE public.disclaimer_templates       FROM dealflow_app;
REVOKE ALL ON TABLE public.compliance_approvals       FROM dealflow_app;
REVOKE ALL ON TABLE public.mandates                   FROM dealflow_app;
REVOKE ALL ON TABLE public.mandate_buyer_criteria     FROM dealflow_app;
REVOKE ALL ON TABLE public.mandate_compliance_profile FROM dealflow_app;
REVOKE ALL ON TABLE public.data_source_connections    FROM dealflow_app;
REVOKE ALL ON TABLE public.raw_companies              FROM dealflow_app;
REVOKE ALL ON TABLE public.companies                  FROM dealflow_app;
REVOKE ALL ON TABLE public.contacts                   FROM dealflow_app;
REVOKE ALL ON TABLE public.company_provenance         FROM dealflow_app;
REVOKE ALL ON TABLE public.contact_provenance         FROM dealflow_app;
REVOKE ALL ON TABLE public.dedupe_candidates          FROM dealflow_app;
REVOKE ALL ON TABLE public.buyer_universe             FROM dealflow_app;
REVOKE ALL ON TABLE public.buyer_universe_candidates  FROM dealflow_app;
REVOKE ALL ON TABLE public.match_run                  FROM dealflow_app;
REVOKE ALL ON TABLE public.match_candidates           FROM dealflow_app;
REVOKE ALL ON TABLE public.outreach_templates         FROM dealflow_app;
REVOKE ALL ON TABLE public.outreach_template_versions FROM dealflow_app;
REVOKE ALL ON TABLE public.outreach                   FROM dealflow_app;
REVOKE ALL ON TABLE public.pipeline                   FROM dealflow_app;
REVOKE ALL ON TABLE public.pipeline_events            FROM dealflow_app;
REVOKE ALL ON TABLE public.workspace_settings         FROM dealflow_app;
REVOKE ALL ON TABLE public.roles                      FROM dealflow_app;
REVOKE ALL ON TABLE public.workspaces                 FROM dealflow_app;
REVOKE ALL ON TABLE public.app_meta                   FROM dealflow_app;

REVOKE ALL ON TABLE drizzle.__drizzle_migrations FROM dealflow_app;
REVOKE USAGE ON SCHEMA drizzle FROM dealflow_app;
REVOKE USAGE ON SCHEMA public  FROM dealflow_app;

DROP ROLE IF EXISTS dealflow_app;
