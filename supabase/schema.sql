create table triage_results (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  message_id text,
  received_at text,
  sender_name text,
  sender_email text,
  subject text,
  body text,
  category text,
  priority text,
  assigned_to text,
  secondary_owner text,
  draft_reply text,
  confidence text,
  flags text[] default '{}',
  reasoning text,
  needs_human_review boolean default false,
  is_reference boolean default false,
  processed_at timestamptz default now()
);

create table escalations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  triage_id uuid references triage_results(id),
  reason text,
  escalation_type text,
  resolved boolean default false
);

create table wrong_queue_log (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  triage_id uuid references triage_results(id),
  redirect_to text,
  redirect_reason text
);

create table agent_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  triage_id uuid references triage_results(id),
  agent_name text,
  input jsonb,
  output jsonb,
  duration_ms integer
);

create table token_usage (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  triage_id uuid references triage_results(id),
  agent_name text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  model text,
  estimated_cost_usd numeric(10, 6)
);

create table triage_feedback (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  triage_id uuid references triage_results(id),
  rating text check (rating in ('correct', 'incorrect')),
  incorrect_field text,
  correct_value text,
  notes text
);

-- Enable Row Level Security
alter table triage_results enable row level security;
alter table escalations enable row level security;
alter table wrong_queue_log enable row level security;
alter table agent_logs enable row level security;
alter table token_usage enable row level security;
alter table triage_feedback enable row level security;

create policy "allow all" on triage_results for all using (true);
create policy "allow all" on escalations for all using (true);
create policy "allow all" on wrong_queue_log for all using (true);
create policy "allow all" on agent_logs for all using (true);
create policy "allow all" on token_usage for all using (true);
create policy "allow all" on triage_feedback for all using (true);