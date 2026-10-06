create table if not exists private.video_provider_readiness (
 provider text primary key, enabled boolean not null default false
);
alter table private.video_provider_readiness enable row level security;
revoke all on private.video_provider_readiness from public,anon,authenticated;
insert into private.video_provider_readiness(provider,enabled) values ('runway',true),('alibaba',false)
on conflict(provider) do nothing;
create or replace function private.video_price_quote(p_model text,p_duration integer,p_resolution text)
returns jsonb language plpgsql immutable set search_path='' as $$
declare v_rate integer; v_cost numeric; v_provider text; v_revenue numeric;
begin
 if p_duration is null or p_duration<2 or p_duration>30 then raise exception 'unsupported duration'; end if;
 if p_model='wan-3-0' then
   v_provider:='alibaba';
   v_rate:=case p_resolution when '480p' then 5 when '720p' then 10 when '1080p' then 19 end;
   v_cost:=case p_resolution when '480p' then .041256 when '720p' then .082513 when '1080p' then .165025 end;
 elsif p_model='wan-3-0-prime' then
   v_provider:='alibaba';
   v_rate:=case p_resolution when '480p' then 8 when '720p' then 16 when '1080p' then 32 end;
   v_cost:=case p_resolution when '480p' then .0636 when '720p' then .127199 when '1080p' then .254399 end;
 elsif p_model='runway-4-5' and p_duration in (6,8,10) and p_resolution='720p' then
   v_provider:='runway'; v_rate:=14; v_cost:=.12;
 end if;
 if v_rate is null then raise exception 'unsupported model, duration or resolution'; end if;
 v_revenue:=v_rate*p_duration*(79.99/3500);
 if 1-(v_cost*p_duration)/v_revenue<.60 then raise exception 'minimum margin not met'; end if;
 return jsonb_build_object('credits',v_rate*p_duration,'creditsPerSecond',v_rate,'provider',v_provider,'apiCost',v_cost*p_duration,'grossMargin',1-(v_cost*p_duration)/v_revenue,'pricingVersion','2026-10-06');
end; $$;
revoke all on function private.video_price_quote(text,integer,text) from public;
grant execute on function private.video_price_quote(text,integer,text) to authenticated;
CREATE OR REPLACE FUNCTION private.enqueue_generation(p_project_id uuid, p_scene_id uuid, p_model text, p_duration integer, p_prompt text, p_request_id uuid, p_resolution text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_cost integer;
  v_quote jsonb;
  v_resolution text;
  v_ratio text;
  v_provider text;
  v_generation_id uuid;
begin
  if v_user is null then
    raise exception using errcode='28000', message='authentication required';
  end if;
  if p_prompt is null or char_length(btrim(p_prompt)) < 3 or char_length(p_prompt) > 4000 then
    raise exception using errcode='22023', message='invalid prompt';
  end if;

  select coalesce(p_resolution,resolution),aspect_ratio into v_resolution,v_ratio
  from public.projects where id=p_project_id and user_id=v_user;
  v_quote := private.video_price_quote(p_model,p_duration,v_resolution);
  v_cost := (v_quote->>'credits')::integer;
  v_provider := v_quote->>'provider';
  if not exists(select 1 from private.video_provider_readiness where provider=v_provider and enabled) then
    raise exception 'provider not configured';
  end if;
  if not exists(
    select 1 from public.projects where id=p_project_id and user_id=v_user
  ) then
    raise exception using errcode='42501', message='project not found';
  end if;
  if not exists(
    select 1 from public.scenes
    where id=p_scene_id and project_id=p_project_id and user_id=v_user
  ) then
    raise exception using errcode='42501', message='scene not found';
  end if;

  select id into v_generation_id
  from public.generations
  where user_id=v_user and client_request_id=p_request_id;
  if v_generation_id is not null then return v_generation_id; end if;

  update public.credit_wallets
  set reserved=reserved+v_cost, updated_at=now()
  where user_id=v_user and balance-reserved>=v_cost;
  if not found then
    raise exception using errcode='P0001', message='insufficient credits';
  end if;

  insert into public.generations(
    scene_id,project_id,user_id,provider,model,request_payload,
    status,credits_reserved,client_request_id
  )
  values(
    p_scene_id,p_project_id,v_user,v_provider,p_model,
    jsonb_build_object('prompt',btrim(p_prompt),'duration',p_duration,'resolution',v_resolution,'aspectRatio',v_ratio,'pricing',v_quote),
    'queued',v_cost,p_request_id
  )
  returning id into v_generation_id;

  insert into public.credit_ledger(user_id,amount,kind,reference_id,description)
  values(v_user,-v_cost,'reservation',v_generation_id::text,'Generation credits reserved');

  -- duration_seconds is the editorial timeline duration. Provider render
  -- duration belongs in generations.request_payload and must not overwrite it.
  update public.scenes
  set prompt=btrim(p_prompt), model=p_model, status='queued', updated_at=now()
  where id=p_scene_id and user_id=v_user;

  update public.projects
  set status='generating',updated_at=now()
  where id=p_project_id and user_id=v_user;

  return v_generation_id;
end;
$function$;

revoke all on function private.enqueue_generation(uuid,uuid,text,integer,text,uuid,text) from public;
grant execute on function private.enqueue_generation(uuid,uuid,text,integer,text,uuid,text) to authenticated;
create or replace function private.enqueue_generation(p_project_id uuid,p_scene_id uuid,p_model text,p_duration integer,p_prompt text,p_request_id uuid)
returns uuid language sql set search_path='' as $$
 select private.enqueue_generation(p_project_id,p_scene_id,p_model,p_duration,p_prompt,p_request_id,null::text);
$$;
create or replace function public.enqueue_generation(p_project_id uuid,p_scene_id uuid,p_model text,p_duration integer,p_prompt text,p_request_id uuid,p_resolution text)
returns uuid language sql set search_path='' as $$
 select private.enqueue_generation(p_project_id,p_scene_id,p_model,p_duration,p_prompt,p_request_id,p_resolution);
$$;
revoke all on function public.enqueue_generation(uuid,uuid,text,integer,text,uuid,text) from public;
grant execute on function public.enqueue_generation(uuid,uuid,text,integer,text,uuid,text) to authenticated;
