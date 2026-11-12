create table if not exists innovations (
  id text primary key,
  owner_sub text not null,
  title text not null,
  axle text not null,
  baseline text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists innovations_owner_idx on innovations (owner_sub, created_at desc);

create table if not exists decks (
  id text primary key,
  owner_sub text not null,
  innovation_id text,
  title text not null,
  prompt text not null,
  pptx_base64 text not null,
  created_at timestamptz not null default now()
);

create index if not exists decks_owner_idx on decks (owner_sub, created_at desc);
