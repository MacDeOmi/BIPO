-- Run this once in Supabase SQL Editor after the base schema.

CREATE OR REPLACE FUNCTION public.prevent_non_admin_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role
     AND NOT EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.role = 'admin'
     ) THEN
    RAISE EXCEPTION 'Only an admin can change profile roles';
  END IF;

  IF OLD.is_banned IS DISTINCT FROM NEW.is_banned
     AND NOT EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.role IN ('moderator', 'admin')
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

DROP POLICY IF EXISTS friendships_update_own ON public.friendships;
DROP POLICY IF EXISTS friendships_update_received ON public.friendships;
CREATE POLICY friendships_update_received
ON public.friendships FOR UPDATE
USING (addressee_id = auth.uid())
WITH CHECK (
  addressee_id = auth.uid()
  AND status IN ('accepted', 'rejected')
  AND requester_id = friendships.requester_id
  AND addressee_id = friendships.addressee_id
);

DROP POLICY IF EXISTS messages_insert_allowed ON public.messages;
CREATE POLICY messages_insert_allowed
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE (
      (f.requester_id = sender_id AND f.addressee_id = receiver_id)
      OR (f.addressee_id = sender_id AND f.requester_id = receiver_id)
    )
    AND f.status = 'accepted'
  )
);

DROP POLICY IF EXISTS threads_delete_moderator ON public.threads;
DROP POLICY IF EXISTS threads_delete_owner_or_moderator ON public.threads;
CREATE POLICY threads_delete_owner_or_moderator
ON public.threads FOR DELETE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('moderator', 'admin')
  )
);

DROP POLICY IF EXISTS casual_plans_delete_moderator ON public.casual_plans;
DROP POLICY IF EXISTS casual_plans_delete_owner_or_moderator ON public.casual_plans;
CREATE POLICY casual_plans_delete_owner_or_moderator
ON public.casual_plans FOR DELETE
USING (
  auth.uid() = creator_id
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('moderator', 'admin')
  )
);

INSERT INTO public.profiles (id, full_name, career, semester, role)
SELECT id, split_part(email, '@', 1), 'Sin carrera', 1, 'admin'::user_role
FROM auth.users
WHERE email = 'omar.alfonso@anahuac.mx'
ON CONFLICT (id)
DO UPDATE SET role = 'admin';
