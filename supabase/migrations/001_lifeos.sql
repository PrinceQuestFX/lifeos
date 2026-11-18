-- LIFEOS — schéma complet. RLS partout : chaque ligne appartient à auth.uid().
create extension if not exists "pgcrypto";

create table profiles (id uuid primary key references auth.users on delete cascade, full_name text, school text default 'HESTIM', program text default 'Cycle ingénieur 1A — Génie Industriel et Logistique', created_at timestamptz default now());
create table user_preferences (
  user_id uuid primary key references auth.users on delete cascade,
  tz text not null default 'Africa/Casablanca',
  group_main text not null default 'A', group_english text not null default '1', group_tec text not null default '1',
  sleep_start time, sleep_end time, commute_min int not null default 0,
  english_minutes_per_day int not null default 60, setup_done boolean not null default false,
  ai_provider text not null default 'anthropic', theme text default 'system', updated_at timestamptz default now());
create table school_groups (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, subject_kind text not null check (subject_kind in ('main','english','tec')), group_label text not null, unique (user_id, subject_kind));
create table timetable_imports (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, file_name text not null, storage_path text, period_from date, period_to date, version int not null default 1, status text not null default 'confirmed', stats jsonb default '{}', created_at timestamptz default now());
create table timetable_events (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, import_id uuid references timetable_imports on delete set null, date date not null, start_time time not null, end_time time not null, title text not null, group_label text, status text not null default 'keep' check (status in ('keep','ignore','ambiguous')), kind text not null default 'cours', category text not null default 'etudes', fingerprint text not null, created_at timestamptz default now(), unique (user_id, fingerprint));
create table activity_categories (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, key text not null, label text not null, color text not null, allow_parallel boolean not null default false, unique (user_id, key));
create table activities (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, title text not null, category text not null, minutes_per_day int, minutes_per_week int, min_block int default 30, priority int default 3, weekdays int[] , preferred_from time, preferred_to time, allow_parallel boolean default false, active boolean default true);
create table work_schedule_templates (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, name text not null, kind text not null default 'habituel', is_default boolean not null default false, active_from date, active_to date, priority int not null default 0, created_at timestamptz default now());
create unique index one_default_template on work_schedule_templates(user_id) where is_default;
create table work_schedule_rules (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, template_id uuid not null references work_schedule_templates on delete cascade, weekday int not null check (weekday between 0 and 6), enabled boolean not null default true, start_time time not null, end_time time not null, fixed boolean default true, mandatory boolean default true, allow_parallel boolean default false, note text);
create table work_schedule_exceptions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, date date not null, kind text not null check (kind in ('replace','off','extra','overtime','late','cancel')), start_time time, end_time time, reason text, mandatory boolean default true, allow_parallel boolean default false, created_at timestamptz default now());
create table work_schedule_history (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, change_type text not null, scope text, period_from date, period_to date, reason text, before jsonb, after jsonb, created_at timestamptz default now());
create table recurring_rules (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, kind text not null, weekday int, start_time time, end_time time, label text, enabled boolean default true);  -- trading, repas
create table tasks (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, parent_id uuid references tasks on delete cascade, title text not null, description text, category text default 'autre', priority int default 3, due_date date, est_minutes int, status text not null default 'todo' check (status in ('todo','doing','done')), recurrence text check (recurrence in ('daily','weekly')), is_checklist_item boolean default false, created_at timestamptz default now());
create table goals (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, name text not null, description text, category text default 'autre', priority int default 3, start_date date default current_date, due_date date, est_minutes int, frequency text, progress int default 0 check (progress between 0 and 100), status text default 'active');
create table habits (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, name text not null, category text default 'autre', weekdays int[] default '{0,1,2,3,4,5,6}', minutes int default 30, active boolean default true);
create table habit_logs (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, habit_id uuid not null references habits on delete cascade, date date not null, done boolean default true, unique (habit_id, date));
create table daily_plans (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, date date not null, kind text default 'jour', note text, unique (user_id, date, kind));
create table planning_events (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, date date not null, start_time time not null, end_time time not null, title text not null, category text not null default 'autre', status text not null default 'planned' check (status in ('planned','done','skipped')), locked boolean default false, allow_parallel boolean default false, task_id uuid references tasks on delete set null, created_at timestamptz default now());
create table availability_slots (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, date date not null, free_min int not null, usable_min int not null, parallel_min int not null, computed_at timestamptz default now(), unique (user_id, date));
create table time_tracking (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, date date not null, category text not null, planned_min int default 0, actual_min int default 0);
create table statistics (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, period text not null, period_start date not null, data jsonb not null, unique (user_id, period, period_start));
create table ai_conversations (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, role text not null check (role in ('user','assistant')), content text not null, proposals jsonb, created_at timestamptz default now());

-- RLS générique : un seul bloc pour toutes les tables à user_id
do $$ declare t text; begin
  foreach t in array array['school_groups','timetable_imports','timetable_events','activity_categories','activities','work_schedule_templates','work_schedule_rules','work_schedule_exceptions','work_schedule_history','recurring_rules','tasks','goals','habits','habit_logs','daily_plans','planning_events','availability_slots','time_tracking','statistics','ai_conversations'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "own_all" on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create index on %I(user_id)', t);
  end loop;
end $$;
alter table profiles enable row level security;
create policy "own_profile" on profiles for all using (id = auth.uid()) with check (id = auth.uid());
alter table user_preferences enable row level security;
create policy "own_prefs" on user_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index on timetable_events(user_id, date);
create index on work_schedule_exceptions(user_id, date);
create index on planning_events(user_id, date);
create index on habit_logs(user_id, date);

-- Bucket privé pour les PDF importés (dossier = user id)
insert into storage.buckets (id, name, public) values ('timetables','timetables', false) on conflict do nothing;
create policy "own_pdf_read" on storage.objects for select using (bucket_id='timetables' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own_pdf_write" on storage.objects for insert with check (bucket_id='timetables' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own_pdf_delete" on storage.objects for delete using (bucket_id='timetables' and (storage.foldername(name))[1] = auth.uid()::text);
