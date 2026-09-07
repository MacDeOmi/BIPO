-- BIPOS social and dating modules.
-- Run after schema.sql and security_patch.sql.

ALTER TABLE public.dating_profiles
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('Hombre', 'Mujer', 'No binario')),
  ADD COLUMN IF NOT EXISTS preferred_genders TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS interests TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE TABLE IF NOT EXISTS public.dating_actions (
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('like', 'reject')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, target_id),
  CHECK (actor_id <> target_id)
);

CREATE TABLE IF NOT EXISTS public.message_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sender_id <> receiver_id)
);

CREATE OR REPLACE FUNCTION public.accept_message_request(request_id UUID)
RETURNS public.message_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_row public.message_requests;
BEGIN
  UPDATE public.message_requests
  SET status = 'accepted'
  WHERE id = request_id
    AND receiver_id = auth.uid()
    AND status = 'pending'
  RETURNING * INTO request_row;

  IF request_row.id IS NULL THEN
    RAISE EXCEPTION 'Message request not found or not owned by current user';
  END IF;

  INSERT INTO public.messages (sender_id, receiver_id, content, type)
  VALUES (request_row.sender_id, request_row.receiver_id, request_row.content, 'direct');

  RETURN request_row;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_message_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_message_request(UUID) TO authenticated;

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dating_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS avatars_insert_authenticated ON storage.objects;
CREATE POLICY avatars_insert_authenticated ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
CREATE POLICY avatars_update_own ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND owner_id = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND owner_id = auth.uid()::text);

DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;
CREATE POLICY avatars_delete_own ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND owner_id = auth.uid()::text);

DROP POLICY IF EXISTS follows_select_auth ON public.follows;
CREATE POLICY follows_select_auth ON public.follows FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS follows_insert_own ON public.follows;
CREATE POLICY follows_insert_own ON public.follows FOR INSERT
WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS follows_delete_own ON public.follows;
CREATE POLICY follows_delete_own ON public.follows FOR DELETE
USING (auth.uid() = follower_id);

DROP POLICY IF EXISTS dating_actions_select_own ON public.dating_actions;
CREATE POLICY dating_actions_select_own ON public.dating_actions FOR SELECT
USING (auth.uid() = actor_id OR auth.uid() = target_id);

DROP POLICY IF EXISTS dating_actions_insert_own ON public.dating_actions;
CREATE POLICY dating_actions_insert_own ON public.dating_actions FOR INSERT
WITH CHECK (auth.uid() = actor_id);

DROP POLICY IF EXISTS dating_actions_update_own ON public.dating_actions;
CREATE POLICY dating_actions_update_own ON public.dating_actions FOR UPDATE
USING (auth.uid() = actor_id)
WITH CHECK (auth.uid() = actor_id);

DROP POLICY IF EXISTS message_requests_select_participants ON public.message_requests;
CREATE POLICY message_requests_select_participants ON public.message_requests FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS message_requests_insert_own ON public.message_requests;
CREATE POLICY message_requests_insert_own ON public.message_requests FOR INSERT
WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS message_requests_update_receiver ON public.message_requests;
CREATE POLICY message_requests_update_receiver ON public.message_requests FOR UPDATE
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id AND status IN ('accepted', 'rejected'));

DROP POLICY IF EXISTS messages_insert_allowed ON public.messages;
CREATE POLICY messages_insert_allowed
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND (
    EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE (
        (f.requester_id = sender_id AND f.addressee_id = receiver_id)
        OR (f.addressee_id = sender_id AND f.requester_id = receiver_id)
      )
      AND f.status = 'accepted'
    )
    OR EXISTS (
      SELECT 1
      FROM public.follows outgoing
      JOIN public.follows incoming
        ON incoming.follower_id = receiver_id
       AND incoming.following_id = sender_id
      WHERE outgoing.follower_id = sender_id
        AND outgoing.following_id = receiver_id
    )
  )
);

DROP POLICY IF EXISTS dating_profiles_public_auth ON public.dating_profiles;
CREATE POLICY dating_profiles_public_auth ON public.dating_profiles FOR SELECT
USING (auth.role() = 'authenticated');

CREATE OR REPLACE VIEW public.dating_matches AS
SELECT a.actor_id AS user_id, a.target_id AS match_id
FROM public.dating_actions a
JOIN public.dating_actions reciprocal
  ON reciprocal.actor_id = a.target_id
 AND reciprocal.target_id = a.actor_id
WHERE a.action = 'like' AND reciprocal.action = 'like';

CREATE OR REPLACE VIEW public.dating_interested_in_me AS
SELECT action.actor_id AS user_id
FROM public.dating_actions action
WHERE action.target_id = auth.uid() AND action.action = 'like';

CREATE OR REPLACE VIEW public.dating_rejected AS
SELECT target_id AS user_id
FROM public.dating_actions
WHERE actor_id = auth.uid() AND action = 'reject';

CREATE OR REPLACE VIEW public.mutual_follows AS
SELECT f.follower_id AS user_id, f.following_id AS other_user_id
FROM public.follows f
JOIN public.follows reciprocal
  ON reciprocal.follower_id = f.following_id
 AND reciprocal.following_id = f.follower_id;

CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_dating_actions_target ON public.dating_actions(target_id, action);
CREATE INDEX IF NOT EXISTS idx_message_requests_receiver ON public.message_requests(receiver_id, status);
