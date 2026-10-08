-- Applied to the Pixenar MV Supabase project after explicit user approval.
-- Worker RPCs already have narrowly assigned EXECUTE permissions.
-- Schema USAGE resolves access through the existing public invoker wrappers.
-- No anonymous grants, RLS changes, or new SECURITY DEFINER functions.
GRANT USAGE ON SCHEMA private TO service_role;
