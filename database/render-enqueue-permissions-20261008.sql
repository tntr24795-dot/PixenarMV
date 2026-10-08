-- Approved repair for authenticated render enqueue access.
-- Private functions retain ownership/auth.uid checks; anon is not granted access.
grant usage on schema private to authenticated;
grant execute on function private.enqueue_generation(uuid,uuid,text,integer,text,uuid,text,uuid[]) to authenticated;
