-- ============================================================
-- Verbose MVP Schema (PostgreSQL)
-- Ready-to-run migration: extensions + enums + tables + indexes
-- ============================================================

BEGIN;

-- 1) Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2) Enums
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('GUEST', 'PROVIDER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE media_type AS ENUM ('IMAGE', 'VIDEO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_target_type AS ENUM ('PROVIDER', 'CLIENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_event_type AS ENUM ('ACTIVATED', 'RENEWED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 3) Tables

-- Users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role user_role NOT NULL DEFAULT 'GUEST',
  display_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);


-- Provider Profiles
CREATE TABLE IF NOT EXISTS provider_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  display_name text NOT NULL,
  bio text,

  state text,
  city text,

  -- Quick MVP modeling:
  -- services: array for speed (switch to join table later if needed)
  services text[] NOT NULL DEFAULT ARRAY[]::text[],

  -- Flexible structures:
  -- rates: e.g. { "short": 20000, "overnight": 80000 }
  rates jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- stats: e.g. { "height": "5'7", "bodyType": "curvy" }
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,

  verification_status verification_status NOT NULL DEFAULT 'NOT_SUBMITTED',
  verification_rejection_reason text,

  is_suspended boolean NOT NULL DEFAULT false,
  suspension_reason text,

  -- Visibility requirement
  subscription_expires_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_location ON provider_profiles(state, city);
CREATE INDEX IF NOT EXISTS idx_provider_verification ON provider_profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_provider_subscription ON provider_profiles(subscription_expires_at);
CREATE INDEX IF NOT EXISTS idx_provider_services_gin ON provider_profiles USING gin(services);


-- Provider Media
CREATE TABLE IF NOT EXISTS provider_media (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  url text NOT NULL,
  type media_type NOT NULL DEFAULT 'IMAGE',
  is_cover boolean NOT NULL DEFAULT false,
  is_avatar boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_media_provider ON provider_media(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_media_cover ON provider_media(provider_id, is_cover);
CREATE INDEX IF NOT EXISTS idx_provider_media_avatar ON provider_media(provider_id, is_avatar);


-- Favorites
CREATE TABLE IF NOT EXISTS favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_provider ON favorites(provider_id);


-- Feed Posts
CREATE TABLE IF NOT EXISTS feed_posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  media_urls text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at ON feed_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_provider ON feed_posts(provider_id);


-- Feed Likes
CREATE TABLE IF NOT EXISTS feed_likes (
  post_id uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_likes_user ON feed_likes(user_id);


-- (Optional) Feed Comments (keep it; you can ignore in code if not needed yet)
CREATE TABLE IF NOT EXISTS feed_comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_comments_post ON feed_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_created_at ON feed_comments(created_at DESC);


-- Reviews (MVP: allow one provider reply stored in same row)
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL,

  reply_text text,
  reply_created_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_provider_created ON reviews(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_user_id);


-- Reports (providers or clients)
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  target_type report_target_type NOT NULL,
  target_provider_id uuid REFERENCES provider_profiles(id) ON DELETE SET NULL,
  target_phone text,
  target_name text,

  reason text NOT NULL,
  evidence_urls text[] NOT NULL DEFAULT ARRAY[]::text[],

  status report_status NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Ensure correct targeting:
  CONSTRAINT chk_reports_target
    CHECK (
      (target_type = 'PROVIDER' AND target_provider_id IS NOT NULL AND target_phone IS NULL)
      OR
      (target_type = 'CLIENT' AND target_provider_id IS NULL AND target_phone IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_target_provider ON reports(target_provider_id);
CREATE INDEX IF NOT EXISTS idx_reports_target_phone ON reports(target_phone);


-- Blacklist Entries (provider-submitted client info)
CREATE TABLE IF NOT EXISTS blacklist_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  submitted_by_provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,

  phone text,
  name text,
  notes text,
  evidence_urls text[] NOT NULL DEFAULT ARRAY[]::text[],

  created_at timestamptz NOT NULL DEFAULT now(),

  -- At least one of phone or name must exist
  CONSTRAINT chk_blacklist_identity CHECK (phone IS NOT NULL OR name IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_blacklist_phone ON blacklist_entries(phone);
CREATE INDEX IF NOT EXISTS idx_blacklist_name ON blacklist_entries(name);


-- Subscription Events (useful for audit even in mock mode)
CREATE TABLE IF NOT EXISTS subscription_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  event_type subscription_event_type NOT NULL,
  amount bigint,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_provider ON subscription_events(provider_id, created_at DESC);


-- Admin Actions (audit trail)
CREATE TABLE IF NOT EXISTS admin_actions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_provider_id uuid REFERENCES provider_profiles(id) ON DELETE SET NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target_provider ON admin_actions(target_provider_id);


COMMIT;

-- ============================================================
-- VISIBILITY QUERY for GET /providers
-- Only show providers who are:
--   1) APPROVED
--   2) not suspended
--   3) have active subscription (expires_at > now)
-- Supports state/city/services filters + pagination
-- ============================================================

/*
-- Params:
--  $1 state (text or NULL)
--  $2 city (text or NULL)
--  $3 services (text[] or NULL)
--  $4 limit (int)
--  $5 offset (int)

SELECT
  p.id,
  p.display_name,
  p.bio,
  p.state,
  p.city,
  p.services,
  p.rates,
  p.stats,
  p.verification_status,
  p.subscription_expires_at,
  p.created_at,

  -- cover + avatar (latest flagged)
  (SELECT url
   FROM provider_media m
   WHERE m.provider_id = p.id AND m.is_cover = true
   ORDER BY m.created_at DESC
   LIMIT 1) AS cover_url,

  (SELECT url
   FROM provider_media m
   WHERE m.provider_id = p.id AND m.is_avatar = true
   ORDER BY m.created_at DESC
   LIMIT 1) AS avatar_url

FROM provider_profiles p
WHERE p.verification_status = 'APPROVED'
  AND p.is_suspended = false
  AND p.subscription_expires_at IS NOT NULL
  AND p.subscription_expires_at > now()
  AND ($1::text IS NULL OR p.state = $1)
  AND ($2::text IS NULL OR p.city = $2)
  AND ($3::text[] IS NULL OR p.services && $3::text[])
ORDER BY p.created_at DESC
LIMIT $4 OFFSET $5;
*/
