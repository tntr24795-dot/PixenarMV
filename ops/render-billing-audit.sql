-- Read-only operational audit for Pixenar Studio render billing.
-- Run in Supabase SQL editor. No customer data is changed.
-- Jobs requiring manual provider reconciliation before credit settlement.
select id, model, provider, status, provider_status,
       credits_reserved, credits_charged, created_at, last_polled_at,
       provider_task_id is not null as has_provider_task
from public.generations
where provider_status = 'billing_review'
   or (status in ('queued','processing') and created_at < now() - interval '35 minutes')
order by created_at asc;

-- Check whether terminal jobs still hold reserved credits.
select status, provider_status, count(*) as jobs,
       coalesce(sum(credits_reserved),0) as reserved_credits
from public.generations
group by status, provider_status
order by jobs desc;

-- Detect duplicate terminal ledger entries for each generation.
select reference_id, kind, count(*) as entries
from public.credit_ledger
where kind in ('refund','generation')
group by reference_id, kind
having count(*) > 1
order by entries desc;

-- IMPORTANT: Do not automatically refund billing_review jobs.
-- Confirm provider billing first, then settle via the existing audited RPC.
