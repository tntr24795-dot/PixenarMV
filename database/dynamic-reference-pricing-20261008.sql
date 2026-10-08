-- Dynamic reference pricing and private per-scene reference metadata.
-- Applied to Supabase on 2026-10-08.

alter table public.project_assets
  add column if not exists scene_id uuid references public.scenes(id) on delete cascade,
  add column if not exists duration_seconds numeric;

create index if not exists project_assets_scene_idx
  on public.project_assets(scene_id, created_at);

create or replace function private.video_price_quote(
  p_model text,
  p_duration integer,
  p_resolution text,
  p_image_count integer,
  p_audio_count integer,
  p_video_seconds numeric
)
returns jsonb
language plpgsql
immutable
set search_path=''
as $$
declare
  v_cost numeric;
  v_api numeric;
  v_budget numeric;
  v_credits integer;
  v_net numeric := (79.99*.92-.30)/3500;
  v_revenue numeric;
  v_image_count integer := greatest(coalesce(p_image_count,0),0);
  v_audio_count integer := greatest(coalesce(p_audio_count,0),0);
  v_video_seconds numeric := greatest(coalesce(p_video_seconds,0),0);
begin
  if p_duration is null then raise exception 'unsupported duration'; end if;

  if p_model='wan-3-0' and p_duration between 2 and 30 then
    v_cost:=case p_resolution when '480p' then .05 when '720p' then .10 when '1080p' then .20 end;
  elsif p_model='wan-3-0-prime' and p_duration between 2 and 30 then
    v_cost:=case p_resolution when '480p' then .068 when '720p' then .14 when '1080p' then .28 end;
  elsif p_model='runway-4-5' and p_duration in (6,8,10) and p_resolution='720p' then
    v_cost:=.12;
  elsif p_model='grok-imagine-1-5' and p_duration between 1 and 15 then
    v_cost:=case p_resolution when '480p' then .10 when '720p' then .16 when '1080p' then .29 end;
  elsif p_model='seedance-2-0' and p_duration between 4 and 15 then
    v_cost:=case p_resolution when '480p' then .36 when '720p' then .36 when '1080p' then .40 end;
  elsif p_model='seedance-2-5' and p_duration between 4 and 30 then
    v_cost:=case p_resolution when '480p' then .20 when '720p' then .30 when '1080p' then .68 end;
  end if;

  if v_cost is null then raise exception 'unsupported model, duration or resolution'; end if;
  v_api:=v_cost*p_duration;

  if p_model='grok-imagine-1-5' then
    if v_image_count>7 or v_audio_count>3 or v_video_seconds>0 then raise exception 'unsupported Grok reference usage'; end if;
    if v_audio_count>0 and v_image_count=0 then raise exception 'Grok audio references require an image reference'; end if;
    if v_image_count>0 and p_resolution='1080p' then raise exception 'Grok image references are capped at 720p'; end if;
    v_api:=v_api+.01*(v_image_count+v_audio_count);
  elsif p_model='seedance-2-5' then
    if v_image_count>30 or v_audio_count>10 or v_video_seconds>30 then raise exception 'Seedance 2.5 reference limit exceeded'; end if;
    v_api:=greatest(.80,v_api+(case p_resolution when '480p' then .10 when '720p' then .15 when '1080p' then .34 end)*v_video_seconds);
  elsif v_image_count>0 or v_audio_count>0 or v_video_seconds>0 then
    raise exception 'references are not enabled for this model';
  end if;

  v_budget:=v_api*1.20+.02;
  v_credits:=ceil(v_budget/(v_net*.375)-.000000001);
  v_revenue:=v_credits*v_net;
  if 1-v_budget/v_revenue<.60 then raise exception 'minimum margin not met'; end if;

  return jsonb_build_object(
    'credits',v_credits,
    'creditsPerSecond',v_credits::numeric/p_duration,
    'provider','runway',
    'apiCost',v_api,
    'costBudget',v_budget,
    'netRevenue',v_revenue,
    'contributionMargin',1-v_budget/v_revenue,
    'grossMargin',1-v_budget/v_revenue,
    'pricingVersion','2026-10-08-ref1',
    'references',jsonb_build_object('imageCount',v_image_count,'audioCount',v_audio_count,'videoSeconds',v_video_seconds)
  );
end;
$$;

revoke all on function private.video_price_quote(text,integer,text,integer,integer,numeric)
  from public,anon,authenticated;

-- The reference-aware enqueue function validates selected asset ownership,
-- scene membership and model-specific reference limits before reserving credits.
-- Production definition is tracked in Supabase migration history under:
-- dynamic_video_reference_pricing_20261008
-- tighten_seedance_reference_limits_20261008
