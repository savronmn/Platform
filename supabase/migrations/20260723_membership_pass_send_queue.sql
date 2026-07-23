-- Scheduled bulk ePass sends from admin Communications page.

CREATE TABLE IF NOT EXISTS public.membership_pass_send_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by uuid,
    created_by_email text,
    subject text NOT NULL,
    message text,
    subscriber_emails text[] NOT NULL,
    scheduled_at timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    sent_count integer NOT NULL DEFAULT 0,
    failed_count integer NOT NULL DEFAULT 0,
    skipped_count integer NOT NULL DEFAULT 0,
    errors jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    CONSTRAINT membership_pass_send_queue_status_check
        CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_membership_pass_send_queue_pending
    ON public.membership_pass_send_queue (scheduled_at)
    WHERE status = 'pending';

ALTER TABLE public.membership_pass_send_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY membership_pass_send_queue_admin ON public.membership_pass_send_queue
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
