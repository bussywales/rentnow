-- Agent commission tracking hardening (audit-safe, no payouts).

ALTER TABLE public.agent_commission_agreements
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS terms_locked boolean not null default false,
  ADD COLUMN IF NOT EXISTS terms_locked_at timestamptz;

CREATE OR REPLACE FUNCTION public.agent_commission_agreements_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'accepted' THEN
        NEW.accepted_at = COALESCE(NEW.accepted_at, now());
        NEW.terms_locked = true;
        NEW.terms_locked_at = COALESCE(NEW.terms_locked_at, now());
      ELSIF NEW.status = 'declined' THEN
        NEW.declined_at = COALESCE(NEW.declined_at, now());
      ELSIF NEW.status = 'void' THEN
        IF NEW.void_reason IS NULL OR btrim(NEW.void_reason) = '' THEN
          RAISE EXCEPTION 'Void reason required';
        END IF;
        NEW.voided_at = COALESCE(NEW.voided_at, now());
      END IF;
    END IF;

    IF OLD.terms_locked IS TRUE OR NEW.terms_locked IS TRUE THEN
      IF NEW.commission_type IS DISTINCT FROM OLD.commission_type
        OR NEW.commission_value IS DISTINCT FROM OLD.commission_value
        OR NEW.currency IS DISTINCT FROM OLD.currency
        OR NEW.notes IS DISTINCT FROM OLD.notes THEN
        RAISE EXCEPTION 'Commission terms are locked after acceptance.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agent_commission_agreements_guard
  ON public.agent_commission_agreements;

CREATE TRIGGER agent_commission_agreements_guard
  BEFORE UPDATE ON public.agent_commission_agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.agent_commission_agreements_guard();

-- RLS tightening: only owners can accept/decline/void.
DROP POLICY IF EXISTS "agent commission agreements update" ON public.agent_commission_agreements;
CREATE POLICY "agent commission agreements update"
  ON public.agent_commission_agreements
  FOR UPDATE
  USING (owner_agent_id = auth.uid())
  WITH CHECK (owner_agent_id = auth.uid());

DROP POLICY IF EXISTS "agent commission agreements delete" ON public.agent_commission_agreements;
CREATE POLICY "agent commission agreements delete"
  ON public.agent_commission_agreements
  FOR DELETE
  USING (owner_agent_id = auth.uid());

DROP POLICY IF EXISTS "agent commission agreements insert" ON public.agent_commission_agreements;
CREATE POLICY "agent commission agreements insert"
  ON public.agent_commission_agreements
  FOR INSERT
  WITH CHECK (presenting_agent_id = auth.uid());
