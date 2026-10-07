CREATE OR REPLACE FUNCTION private.fail_generation(p_generation_id uuid, p_error_message text, p_provider_status text DEFAULT 'failed'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.generations%rowtype;
begin
 select * into v from public.generations where id=p_generation_id for update;
 if not found then return false; end if;
 if v.status in ('succeeded','failed','cancelled') then return v.status='failed'; end if;
 if p_provider_status not in ('confirmed_refundable','billed_failure') then
   update public.generations set provider_status='billing_review',error_message=left(coalesce(p_error_message,'Billing review required'),1000),last_polled_at=now() where id=v.id;
   return false;
 end if;
 if p_provider_status='billed_failure' then
   update public.credit_wallets set balance=balance-v.credits_reserved where user_id=v.user_id;
 end if;
 update public.credit_wallets set reserved=greatest(0,reserved-v.credits_reserved),updated_at=now() where user_id=v.user_id;
 update public.generations set status='failed',credits_charged=case when p_provider_status='billed_failure' then v.credits_reserved else 0 end,credits_reserved=0,error_message=left(coalesce(p_error_message,'Generation failed'),1000),
 provider_status=left(coalesce(p_provider_status,'failed'),80),completed_at=now(),last_polled_at=now() where id=v.id;
 insert into public.credit_ledger(user_id,amount,kind,reference_id,description)
 values(v.user_id,case when p_provider_status='billed_failure' then -v.credits_reserved else v.credits_reserved end,case when p_provider_status='billed_failure' then 'generation' else 'refund' end,v.id::text,'Provider failure billing settled');
 update public.scenes set status='failed',updated_at=now() where id=v.scene_id and user_id=v.user_id;
 if not exists(select 1 from public.generations where project_id=v.project_id and status in ('queued','processing')) then
   update public.projects set status='storyboarding',updated_at=now() where id=v.project_id and user_id=v.user_id;
 end if;
 return true;
end $function$;

create or replace function public.claim_generation_submission(p_generation_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.generations set status='processing',provider_status='SUBMITTING'
 where id=p_generation_id and status='queued' and provider_task_id is null;
 return found;
end;$$;
revoke all on function public.claim_generation_submission(uuid) from public,anon,authenticated;
grant execute on function public.claim_generation_submission(uuid) to service_role;

