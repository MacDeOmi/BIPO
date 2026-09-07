-- Run this in Supabase SQL Editor to repair message requests and chats.

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
    RAISE EXCEPTION 'Message request not found or already processed';
  END IF;

  INSERT INTO public.messages (sender_id, receiver_id, content, type)
  VALUES (request_row.sender_id, request_row.receiver_id, request_row.content, 'direct');

  RETURN request_row;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_message_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_message_request(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_messages_read(conversation_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.messages
  SET is_read = TRUE
  WHERE receiver_id = auth.uid()
    AND sender_id = conversation_user_id
    AND is_read = FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_messages_read(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(UUID) TO authenticated;

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

-- Repair requests accepted before the conversion function existed.
INSERT INTO public.messages (sender_id, receiver_id, content, type)
SELECT request.sender_id, request.receiver_id, request.content, 'direct'
FROM public.message_requests request
WHERE request.status = 'accepted'
  AND NOT EXISTS (
    SELECT 1
    FROM public.messages message
    WHERE message.sender_id = request.sender_id
      AND message.receiver_id = request.receiver_id
      AND message.content = request.content
  );
