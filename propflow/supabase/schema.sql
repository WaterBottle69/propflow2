-- ══════════════════════════════════════════════════════════════════════════
-- PropFlow — Supabase Database Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════════════════════

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- for full-text search

-- ── HELPER: updated_at trigger ────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ══════════════════════════════════════════════════════════════════════════
-- TEAMS
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists teams (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  brokerage   text,
  leader_id   uuid, -- FK added after profiles
  max_agents  int  default 10,
  logo_url    text,
  created_at  timestamptz default now()
);

-- ══════════════════════════════════════════════════════════════════════════
-- PROFILES  (mirrors auth.users, one row per user)
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  full_name            text,
  email                text,
  phone                text,
  avatar_url           text,
  bio                  text,
  license_number       text,
  role                 text not null default 'agent'
                         check (role in ('agent','team_leader')),
  brokerage            text,
  team_id              uuid references teams(id) on delete set null,

  -- Stripe
  stripe_customer_id   text unique,
  subscription_status  text default 'trial'
                         check (subscription_status in ('trial','active','past_due','canceled','trialing')),
  subscription_plan    text default 'starter'
                         check (subscription_plan in ('starter','pro','team')),
  trial_ends_at        timestamptz default (now() + interval '14 days'),

  -- Notification prefs (stored as booleans)
  notif_new_lead       boolean default true,
  notif_price_drop     boolean default true,
  notif_offer          boolean default true,
  notif_message        boolean default true,
  notif_weekly_report  boolean default true,

  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- Add FK from teams back to profiles
alter table teams
  add constraint fk_team_leader
  foreign key (leader_id) references profiles(id) on delete set null;

create trigger tr_profiles_updated before update on profiles
  for each row execute function update_updated_at();

-- ══════════════════════════════════════════════════════════════════════════
-- LISTINGS
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists listings (
  id               uuid primary key default uuid_generate_v4(),
  agent_id         uuid not null references profiles(id) on delete cascade,
  team_id          uuid references teams(id) on delete set null,

  -- Location
  address          text not null,
  city             text,
  state            text,
  zip              text,
  lat              numeric(10,7),
  lng              numeric(10,7),

  -- Status & type
  listing_type     text not null default 'sale'
                     check (listing_type in ('sale','rent','new_construction')),
  status           text not null default 'draft'
                     check (status in ('draft','active','pending_approval','pending','sold','rented','withdrawn')),
  property_type    text default 'single_family'
                     check (property_type in ('single_family','condo','townhouse','multi_family','land','commercial')),

  -- Pricing
  price            numeric(12,0),
  price_per_sqft   numeric(8,2),

  -- Specs
  beds             int,
  baths            numeric(3,1),
  sqft             int,
  lot_size_sqft    int,
  year_built       int,
  garage_spaces    int,
  stories          int,

  -- Content
  description      text,
  features         text[],
  photos           text[],
  virtual_tour_url text,

  -- Schools
  school_score     int check (school_score between 1 and 10),
  school_district  text,

  -- Platform IDs
  mls_number       text,
  zillow_zpid      text,
  realtor_id       text,

  -- Publish flags
  published_zillow  boolean default false,
  published_realtor boolean default false,
  published_mls     boolean default false,

  -- Team approval
  approval_status  text default 'pending'
                     check (approval_status in ('pending','approved','rejected')),
  approved_by      uuid references profiles(id),
  approved_at      timestamptz,
  rejection_note   text,

  -- Timestamps
  listed_at        timestamptz,
  sold_at          timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create trigger tr_listings_updated before update on listings
  for each row execute function update_updated_at();

-- ══════════════════════════════════════════════════════════════════════════
-- CLIENTS  (CRM)
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists clients (
  id                 uuid primary key default uuid_generate_v4(),
  agent_id           uuid not null references profiles(id) on delete cascade,

  full_name          text not null,
  email              text,
  phone              text,
  avatar_initials    text,

  client_type        text not null default 'buyer'
                       check (client_type in ('buyer','seller','renter','investor')),
  stage              text not null default 'new'
                       check (stage in ('new','active','offer','closing','closed','lost')),
  source             text, -- 'Zillow', 'Referral', 'Website', 'Open house', etc.

  -- Preferences
  budget_min         numeric(12,0),
  budget_max         numeric(12,0),
  preferred_beds     int,
  preferred_baths    numeric(3,1),
  preferred_sqft_min int,
  preferred_areas    text[],
  notes              text,

  -- Contact
  preferred_contact  text default 'email'
                       check (preferred_contact in ('email','phone','text')),
  last_contacted_at  timestamptz,

  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create trigger tr_clients_updated before update on clients
  for each row execute function update_updated_at();

-- ══════════════════════════════════════════════════════════════════════════
-- CONVERSATIONS & MESSAGES
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists conversations (
  id              uuid primary key default uuid_generate_v4(),
  agent_id        uuid not null references profiles(id) on delete cascade,
  client_id       uuid references clients(id) on delete cascade,
  title           text,
  last_message    text,
  last_message_at timestamptz,
  unread_count    int default 0,
  created_at      timestamptz default now()
);

create table if not exists messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_type     text not null check (sender_type in ('agent','client','system','ai')),
  sender_id       uuid,
  content         text not null,
  attachments     text[],
  read            boolean default false,
  created_at      timestamptz default now()
);

-- ══════════════════════════════════════════════════════════════════════════
-- APPOINTMENTS  (calendar events)
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists appointments (
  id                uuid primary key default uuid_generate_v4(),
  agent_id          uuid not null references profiles(id) on delete cascade,
  client_id         uuid references clients(id) on delete set null,
  listing_id        uuid references listings(id) on delete set null,

  title             text not null,
  description       text,
  appointment_type  text default 'showing'
                      check (appointment_type in ('showing','meeting','open_house',
                                                  'offer_review','closing','inspection','other')),
  starts_at         timestamptz not null,
  ends_at           timestamptz,
  location          text,

  -- Google Calendar sync
  google_event_id   text,
  google_meet_url   text,

  status            text default 'scheduled'
                      check (status in ('scheduled','confirmed','completed','canceled')),

  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create trigger tr_appointments_updated before update on appointments
  for each row execute function update_updated_at();

-- ══════════════════════════════════════════════════════════════════════════
-- SAVED SEARCHES
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists saved_searches (
  id         uuid primary key default uuid_generate_v4(),
  agent_id   uuid not null references profiles(id) on delete cascade,
  client_id  uuid references clients(id) on delete set null,
  name       text,
  prompt     text not null,
  filters    jsonb default '{}',
  last_run   timestamptz,
  created_at timestamptz default now()
);

-- ══════════════════════════════════════════════════════════════════════════
-- NOTIFICATIONS
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references profiles(id) on delete cascade,
  type       text not null
               check (type in ('lead','listing','price_drop','offer','message','system','approval')),
  title      text not null,
  body       text,
  link       text,
  read       boolean default false,
  created_at timestamptz default now()
);

-- ══════════════════════════════════════════════════════════════════════════
-- INTEGRATIONS  (connected 3rd-party platforms)
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists integrations (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references profiles(id) on delete cascade,
  platform         text not null
                     check (platform in ('zillow','realtor','mls','google_calendar',
                                        'docusign','dotloop','twilio')),
  status           text not null default 'connected'
                     check (status in ('connected','disconnected','error')),
  access_token     text,   -- store encrypted in production
  refresh_token    text,
  token_expires_at timestamptz,
  external_id      text,   -- platform-specific user/account ID
  metadata         jsonb default '{}',
  connected_at     timestamptz default now(),
  updated_at       timestamptz default now(),
  unique(user_id, platform)
);

create trigger tr_integrations_updated before update on integrations
  for each row execute function update_updated_at();

-- ══════════════════════════════════════════════════════════════════════════
-- SUBSCRIPTIONS  (Stripe)
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists subscriptions (
  id                      uuid primary key default uuid_generate_v4(),
  user_id                 uuid not null references profiles(id) on delete cascade,
  stripe_subscription_id  text unique,
  stripe_customer_id      text,
  plan                    text not null check (plan in ('starter','pro','team')),
  status                  text not null
                            check (status in ('trialing','active','past_due','canceled','unpaid')),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean default false,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

create trigger tr_subscriptions_updated before update on subscriptions
  for each row execute function update_updated_at();

-- ══════════════════════════════════════════════════════════════════════════
-- AI COMMAND LOG  (audit trail of all AI actions)
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists ai_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references profiles(id) on delete cascade,
  action      text not null,
  prompt      text,
  response    jsonb,
  tokens_used int,
  duration_ms int,
  created_at  timestamptz default now()
);

-- ══════════════════════════════════════════════════════════════════════════
-- TRIGGER: auto-create profile row when user signs up
-- ══════════════════════════════════════════════════════════════════════════
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role, brokerage)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'agent'),
    new.raw_user_meta_data->>'brokerage'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════

alter table profiles       enable row level security;
alter table teams          enable row level security;
alter table listings       enable row level security;
alter table clients        enable row level security;
alter table conversations  enable row level security;
alter table messages       enable row level security;
alter table appointments   enable row level security;
alter table saved_searches enable row level security;
alter table notifications  enable row level security;
alter table integrations   enable row level security;
alter table subscriptions  enable row level security;
alter table ai_logs        enable row level security;

-- PROFILES: view self; team leader views team
create policy "profiles_select" on profiles for select using (
  auth.uid() = id
  or (
    team_id is not null
    and team_id = (select team_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'team_leader'
  )
);
create policy "profiles_insert" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- TEAMS
create policy "teams_select" on teams for select using (
  id = (select team_id from profiles where id = auth.uid())
  or leader_id = auth.uid()
);
create policy "teams_manage" on teams for all using (leader_id = auth.uid());

-- LISTINGS: own + team
create policy "listings_select" on listings for select using (
  agent_id = auth.uid()
  or (team_id is not null and team_id = (select team_id from profiles where id = auth.uid()))
);
create policy "listings_insert" on listings for insert with check (agent_id = auth.uid());
create policy "listings_update" on listings for update using (
  agent_id = auth.uid()
  or (
    team_id is not null
    and team_id = (select team_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'team_leader'
  )
);
create policy "listings_delete" on listings for delete using (agent_id = auth.uid());

-- CLIENTS
create policy "clients_all" on clients for all using (agent_id = auth.uid());

-- CONVERSATIONS
create policy "conversations_all" on conversations for all using (agent_id = auth.uid());

-- MESSAGES (via conversation ownership)
create policy "messages_select" on messages for select using (
  conversation_id in (select id from conversations where agent_id = auth.uid())
);
create policy "messages_insert" on messages for insert with check (
  conversation_id in (select id from conversations where agent_id = auth.uid())
);

-- APPOINTMENTS
create policy "appointments_all" on appointments for all using (agent_id = auth.uid());

-- SAVED SEARCHES
create policy "saved_searches_all" on saved_searches for all using (agent_id = auth.uid());

-- NOTIFICATIONS
create policy "notifications_all" on notifications for all using (user_id = auth.uid());

-- INTEGRATIONS
create policy "integrations_all" on integrations for all using (user_id = auth.uid());

-- SUBSCRIPTIONS
create policy "subscriptions_select" on subscriptions for select using (user_id = auth.uid());

-- AI LOGS
create policy "ai_logs_all" on ai_logs for all using (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════════
-- INDEXES  (performance)
-- ══════════════════════════════════════════════════════════════════════════
create index if not exists idx_listings_agent        on listings(agent_id);
create index if not exists idx_listings_status       on listings(status);
create index if not exists idx_listings_price        on listings(price);
create index if not exists idx_clients_agent         on clients(agent_id);
create index if not exists idx_clients_stage         on clients(stage);
create index if not exists idx_conversations_agent   on conversations(agent_id);
create index if not exists idx_messages_conversation on messages(conversation_id);
create index if not exists idx_appointments_agent    on appointments(agent_id);
create index if not exists idx_appointments_starts   on appointments(starts_at);
create index if not exists idx_notifications_user    on notifications(user_id, read);
create index if not exists idx_ai_logs_user          on ai_logs(user_id);
