-- The dashboard Promotions card (retention-campaign-page Decision 9) reads
-- outreach_messages for the logged-in member, but the table only ever had
-- a staff-wide SELECT policy — a client could never see their own sent
-- promotions, making the card silently empty for every real member.
-- Add an own-row read policy scoped to sent messages only: a member should
-- never see a draft targeting them before staff has actually sent it.

create policy "outreach_messages_select_own"
on public.outreach_messages
for select
to authenticated
using (
  status = 'sent'
  and target_member_id in (
    select id from public.members where auth_user_id = auth.uid()
  )
);
