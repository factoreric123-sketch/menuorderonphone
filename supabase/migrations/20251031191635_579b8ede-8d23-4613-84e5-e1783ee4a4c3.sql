-- Create subscriptions table
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null check (status in ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  plan_type text not null check (plan_type in ('free', 'premium')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.subscriptions enable row level security;

-- Users can view their own subscription
create policy "Users can view own subscription"
  on public.subscriptions
  for select
  to authenticated
  using (user_id = auth.uid());

-- Create indexes for fast lookups
create index subscriptions_user_id_idx on public.subscriptions(user_id);
create index subscriptions_stripe_customer_id_idx on public.subscriptions(stripe_customer_id);

-- Function to check if user has active premium subscription
create or replace function public.has_premium_subscription(user_id_param uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions
    where user_id = user_id_param
    and plan_type = 'premium'
    and status = 'active'
  );
$$;

-- Function to get user's subscription status
create or replace function public.get_subscription_status()
returns table (
  has_premium boolean,
  status text,
  plan_type text,
  current_period_end timestamptz,
  cancel_at_period_end boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select 
    (plan_type = 'premium' and status = 'active') as has_premium,
    status,
    plan_type,
    current_period_end,
    cancel_at_period_end
  from public.subscriptions
  where user_id = auth.uid()
  limit 1;
$$;

-- Automatically create free subscription for new users
create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (user_id, status, plan_type)
  values (new.id, 'active', 'free');
  return new;
end;
$$;

create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function public.handle_new_user_subscription();