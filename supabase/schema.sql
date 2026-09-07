-- =====================================================
-- Anahuac Community Platform - Supabase Schema
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin');
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE message_type AS ENUM ('direct', 'request');

CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  career TEXT NOT NULL,
  semester INT NOT NULL,
  bio TEXT,
  interests TEXT[],
  avatar_url TEXT,
  gallery_urls TEXT[],
  is_private BOOLEAN DEFAULT FALSE,
  role user_role DEFAULT 'user',
  is_banned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE friendships (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  requester_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status friendship_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (requester_id, addressee_id)
);

CREATE TABLE threads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dating_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  looking_for TEXT,
  prompt_answers JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE casual_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  meet_time TIMESTAMPTZ NOT NULL,
  max_participants INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type message_type DEFAULT 'direct',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Supabase Storage Buckets
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('thread_media', 'thread_media', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- Trigger: create profile on auth signup
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, career, semester, bio, interests)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Nuevo usuario'),
    COALESCE(NEW.raw_user_meta_data ->> 'career', 'Sin carrera'),
    COALESCE((NEW.raw_user_meta_data ->> 'semester')::int, 1),
    COALESCE(NEW.raw_user_meta_data ->> 'bio', 'Hola, soy parte de la comunidad.'),
    ARRAY['General']::TEXT[]
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.prevent_non_admin_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role
     AND NOT EXISTS (
       SELECT 1
       FROM public.profiles admin_profile
       WHERE admin_profile.id = auth.uid()
         AND admin_profile.role = 'admin'
     ) THEN
    RAISE EXCEPTION 'Only an admin can change profile roles';
  END IF;

  IF OLD.is_banned IS DISTINCT FROM NEW.is_banned
     AND NOT EXISTS (
       SELECT 1
       FROM public.profiles moderator_profile
       WHERE moderator_profile.id = auth.uid()
         AND moderator_profile.role IN ('moderator', 'admin')
     ) THEN
    RAISE EXCEPTION 'Only a moderator or admin can change ban status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_role ON public.profiles;
CREATE TRIGGER protect_profile_role
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_non_admin_role_change();

CREATE OR REPLACE FUNCTION public.prevent_friendship_endpoint_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.requester_id IS DISTINCT FROM NEW.requester_id
     OR OLD.addressee_id IS DISTINCT FROM NEW.addressee_id THEN
    RAISE EXCEPTION 'Friendship participants cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_friendship_endpoints ON public.friendships;
CREATE TRIGGER protect_friendship_endpoints
BEFORE UPDATE ON public.friendships
FOR EACH ROW
EXECUTE FUNCTION public.prevent_friendship_endpoint_change();

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE dating_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE casual_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_public"
ON profiles FOR SELECT
USING (true);

CREATE POLICY "profiles_insert_own"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "friendships_select_own_or_accepted"
ON friendships FOR SELECT
USING (
  requester_id = auth.uid()
  OR addressee_id = auth.uid()
  OR status = 'accepted'
);

CREATE POLICY "friendships_insert_own"
ON friendships FOR INSERT
WITH CHECK (
  requester_id = auth.uid()
  OR addressee_id = auth.uid()
);

CREATE POLICY "friendships_update_received"
ON friendships FOR UPDATE
USING (
  addressee_id = auth.uid()
)
WITH CHECK (
  addressee_id = auth.uid()
  AND status IN ('accepted', 'rejected')
  AND requester_id = friendships.requester_id
  AND addressee_id = friendships.addressee_id
);

CREATE POLICY "threads_select_auth_users"
ON threads FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = threads.user_id
      AND (
        p.is_private = FALSE
        OR p.id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM friendships f
          WHERE (
            (f.requester_id = auth.uid() AND f.addressee_id = threads.user_id)
            OR (f.addressee_id = auth.uid() AND f.requester_id = threads.user_id)
          )
          AND f.status = 'accepted'
        )
      )
  )
);

CREATE POLICY "threads_insert_own"
ON threads FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "threads_update_own"
ON threads FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "threads_delete_owner_or_moderator"
ON threads FOR DELETE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('moderator', 'admin')
  )
);

CREATE POLICY "dating_profiles_select_auth"
ON dating_profiles FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "dating_profiles_manage_own"
ON dating_profiles FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "casual_plans_select_auth"
ON casual_plans FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "casual_plans_insert_own"
ON casual_plans FOR INSERT
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "casual_plans_update_own"
ON casual_plans FOR UPDATE
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "casual_plans_delete_owner_or_moderator"
ON casual_plans FOR DELETE
USING (
  auth.uid() = creator_id
  OR EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('moderator', 'admin')
  )
);

CREATE POLICY "messages_select_own_or_friend"
ON messages FOR SELECT
USING (
  sender_id = auth.uid()
  OR receiver_id = auth.uid()
);

CREATE POLICY "messages_insert_allowed"
ON messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND (
    EXISTS (
      SELECT 1
      FROM friendships f
      WHERE (
        (f.requester_id = sender_id AND f.addressee_id = receiver_id)
        OR (f.addressee_id = sender_id AND f.requester_id = receiver_id)
      )
      AND f.status = 'accepted'
    )
    OR EXISTS (
      SELECT 1
      FROM follows outgoing
      JOIN follows incoming
        ON incoming.follower_id = receiver_id
       AND incoming.following_id = sender_id
      WHERE outgoing.follower_id = sender_id
        AND outgoing.following_id = receiver_id
    )
  )
);

CREATE POLICY "messages_update_own"
ON messages FOR UPDATE
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "profiles_admin_role_update"
ON profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

CREATE POLICY "profiles_moderator_ban"
ON profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('moderator', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('moderator', 'admin')
  )
);

CREATE INDEX IF NOT EXISTS idx_friendships_users
ON friendships (requester_id, addressee_id, status);

CREATE INDEX IF NOT EXISTS idx_threads_created_at
ON threads (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
ON messages (sender_id, receiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_casual_plans_time
ON casual_plans (meet_time);
