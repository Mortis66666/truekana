begin;

alter table public.progress
  add column if not exists deferred_next_session boolean not null default false;

drop function if exists public.review_card(uuid, text, boolean);

create or replace function public.review_card(
  p_study_set uuid,
  p_card text,
  p_correct boolean
)
returns public.progress
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_settings jsonb;
  v_mode text;
  v_retry integer;
  v_old public.progress;
  v_status smallint;
  v_due timestamptz;
  v_interval real;
  v_ease real;
  v_reps integer;
  v_lapses integer;
  v_deferred boolean := false;
  v_behavior text;
  v_delay integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select settings into v_settings from study_sets
    where id = p_study_set and user_id = v_user;
  if not found then raise exception 'Study set not found'; end if;
  if not exists (
    select 1 from cards c
    join study_set_decks sd on sd.deck_id = c.deck_id
    where c.id = p_card and sd.study_set_id = p_study_set
  ) then raise exception 'Card is not in this study set'; end if;

  v_mode := coalesce(v_settings->>'reviewMode', 'srs');
  v_retry := greatest(1, coalesce((v_settings->>'wrongRetryMinutes')::integer, 10));
  select * into v_old from progress where study_set_id = p_study_set and card_id = p_card;
  v_ease := coalesce(v_old.ease_factor, 2.5);
  v_reps := coalesce(v_old.reps, 0);
  v_lapses := coalesce(v_old.lapses, 0);

  if p_correct then
    v_status := 1;
    v_reps := v_reps + 1;
    if v_mode = 'simple' then
      v_behavior := coalesce(v_settings->>'correctBehavior', 'never');
      v_delay := greatest(1, coalesce((v_settings->>'correctDelayMinutes')::integer, 10));
      if v_behavior = 'next_session' then
        v_due := 'infinity';
        v_deferred := true;
      elsif v_behavior = 'next_day' then
        v_due := now() + interval '1 day';
      elsif v_behavior = 'constant' then
        v_due := now() + make_interval(mins => v_delay);
      else
        v_due := 'infinity';
      end if;
      v_interval := 0;
    elsif v_mode in ('once', 'wrong_only') then
      v_due := 'infinity';
      v_interval := coalesce(v_old.interval_days, 0);
    elsif v_reps = 1 then
      v_interval := 1;
      v_due := now() + interval '1 day';
    elsif v_reps = 2 then
      v_interval := 3;
      v_due := now() + interval '3 days';
    else
      v_interval := greatest(1, round(coalesce(v_old.interval_days, 1) * v_ease));
      v_due := now() + make_interval(days => v_interval::integer);
    end if;
  else
    v_status := 0;
    v_lapses := v_lapses + 1;
    v_reps := 0;
    v_interval := 0;
    v_ease := greatest(1.3, v_ease - 0.2);
    if v_mode = 'simple' then
      v_behavior := coalesce(v_settings->>'wrongBehavior', 'next_session');
      v_delay := greatest(1, coalesce((v_settings->>'wrongDelayMinutes')::integer, 10));
      if v_behavior = 'next_session' then
        v_due := 'infinity';
        v_deferred := true;
      elsif v_behavior = 'next_day' then
        v_due := now() + interval '1 day';
      elsif v_behavior = 'constant' then
        v_due := now() + make_interval(mins => v_delay);
      else
        v_due := 'infinity';
      end if;
    elsif v_mode = 'once' then
      v_due := 'infinity';
    else
      v_due := now() + make_interval(mins => v_retry);
    end if;
  end if;

  insert into progress (study_set_id, card_id, user_id, status, due, interval_days, ease_factor, reps, lapses, last_reviewed, deferred_next_session)
  values (p_study_set, p_card, v_user, v_status, v_due, v_interval, v_ease, v_reps, v_lapses, now(), v_deferred)
  on conflict (study_set_id, card_id) do update set
    user_id = excluded.user_id, status = excluded.status, due = excluded.due,
    interval_days = excluded.interval_days, ease_factor = excluded.ease_factor,
    reps = excluded.reps, lapses = excluded.lapses, last_reviewed = excluded.last_reviewed,
    deferred_next_session = excluded.deferred_next_session
  returning * into v_old;
  return v_old;
end;
$$;

commit;
