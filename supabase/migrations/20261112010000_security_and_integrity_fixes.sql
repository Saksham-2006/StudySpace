-- ========================================================================
-- SEAT TO STUDY — CORRECTIVE SECURITY & DATABASE INTEGRITY MIGRATION
-- Migration ID: 20261112010000_security_and_integrity_fixes.sql
-- Applies hardened RLS, composite constraints, and secured RPCs to an
-- existing Seat to Study database without losing existing user records.
-- ========================================================================

-- 1. SECURE HELPER FUNCTION (NO RECURSION)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- 2. HARDEN USER REGISTRATION & PROFILE INTEGRITY
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'student'
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      email = EXCLUDED.email,
      updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.id := OLD.id;
  NEW.email := OLD.email;
  
  -- Prevent privilege escalation: only existing admins can alter the role
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_admin() THEN
      NEW.role := OLD.role;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;
CREATE TRIGGER on_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_profile_update();

-- Drop recursive update policy on profiles and replace with safe policy
DROP POLICY IF EXISTS "Users can update their own profile name" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- 3. ADD DATABASE INTEGRITY CONSTRAINTS
-- A. Buildings unique name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'buildings_name_unique'
  ) THEN
    ALTER TABLE public.buildings ADD CONSTRAINT buildings_name_unique UNIQUE (name);
  END IF;
END $$;

-- B. Zones composite unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'zones_building_name_unique'
  ) THEN
    ALTER TABLE public.zones ADD CONSTRAINT zones_building_name_unique UNIQUE (building_id, name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'zones_id_building_id_unique'
  ) THEN
    ALTER TABLE public.zones ADD CONSTRAINT zones_id_building_id_unique UNIQUE (id, building_id);
  END IF;
END $$;

-- C. Spaces integrity constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'spaces_name_unique'
  ) THEN
    ALTER TABLE public.spaces ADD CONSTRAINT spaces_name_unique UNIQUE (name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'spaces_valid_hours'
  ) THEN
    ALTER TABLE public.spaces ADD CONSTRAINT spaces_valid_hours CHECK (closing_time > opening_time);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_spaces_zone_building'
  ) THEN
    ALTER TABLE public.spaces
    ADD CONSTRAINT fk_spaces_zone_building
    FOREIGN KEY (zone_id, building_id)
    REFERENCES public.zones(id, building_id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- D. Seats composite unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seats_id_space_id_unique'
  ) THEN
    ALTER TABLE public.seats ADD CONSTRAINT seats_id_space_id_unique UNIQUE (id, space_id);
  END IF;
END $$;

-- E. Seat capacity check trigger
CREATE OR REPLACE FUNCTION public.check_space_seat_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_capacity INT;
  v_current_count INT;
BEGIN
  SELECT capacity INTO v_capacity FROM public.spaces WHERE id = NEW.space_id;
  IF FOUND AND v_capacity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count FROM public.seats WHERE space_id = NEW.space_id AND id <> NEW.id;
    IF v_current_count >= v_capacity THEN
      RAISE EXCEPTION 'Cannot add seat: space capacity of % has been reached.', v_capacity;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_seat_capacity ON public.seats;
CREATE TRIGGER trg_check_seat_capacity
  BEFORE INSERT ON public.seats
  FOR EACH ROW EXECUTE FUNCTION public.check_space_seat_capacity();

-- F. Bookings composite foreign key ensuring seat belongs to space
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_bookings_seat_space'
  ) THEN
    ALTER TABLE public.bookings
    ADD CONSTRAINT fk_bookings_seat_space
    FOREIGN KEY (seat_id, space_id)
    REFERENCES public.seats(id, space_id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- G. Occupancy logs check constraint update to include 'cancellation'
ALTER TABLE public.occupancy_logs DROP CONSTRAINT IF EXISTS occupancy_logs_event_type_check;
ALTER TABLE public.occupancy_logs ADD CONSTRAINT occupancy_logs_event_type_check
  CHECK (event_type IN ('check_in', 'check_out', 'auto_checkout', 'no_show_cancellation', 'manual_override', 'cancellation'));

-- 4. HARDEN ROW LEVEL SECURITY POLICIES
-- Bookings: Prevent direct student INSERT / UPDATE operations
DROP POLICY IF EXISTS "Users view their own bookings or admins view all" ON public.bookings;
DROP POLICY IF EXISTS "Bookings are viewable by owner, admins, or active seat reservations" ON public.bookings;
CREATE POLICY "Bookings are viewable by owner, admins, or active seat reservations"
  ON public.bookings FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_admin()
    OR status IN ('confirmed', 'checked_in')
  );

DROP POLICY IF EXISTS "Authenticated users create their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can insert bookings directly" ON public.bookings;
CREATE POLICY "Admins can insert bookings directly"
  ON public.bookings FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can update own bookings or admins manage" ON public.bookings;
DROP POLICY IF EXISTS "Admins can update bookings directly" ON public.bookings;
CREATE POLICY "Admins can update bookings directly"
  ON public.bookings FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete bookings" ON public.bookings;
CREATE POLICY "Admins can delete bookings"
  ON public.bookings FOR DELETE
  USING (public.is_admin());

-- Occupancy Logs: Prevent direct student INSERT operations
DROP POLICY IF EXISTS "Allow authenticated create occupancy logs" ON public.occupancy_logs;
DROP POLICY IF EXISTS "Admins can insert occupancy logs directly" ON public.occupancy_logs;
CREATE POLICY "Admins can insert occupancy logs directly"
  ON public.occupancy_logs FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage occupancy logs" ON public.occupancy_logs;
CREATE POLICY "Admins can manage occupancy logs"
  ON public.occupancy_logs FOR ALL
  USING (public.is_admin());

-- 5. SECURED STORED PROCEDURES / RPC FUNCTIONS

-- A. Atomic Seat Booking Procedure
CREATE OR REPLACE FUNCTION public.create_seat_booking(
  p_seat_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_seat RECORD;
  v_space RECORD;
  v_rule RECORD;
  v_conflict_count INT;
  v_duration_mins INT;
  v_new_booking RECORD;
  v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
  -- 1. Validate Authentication
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create a booking.';
  END IF;

  -- 2. Validate Parameters
  IF p_seat_id IS NULL OR p_start_at IS NULL OR p_end_at IS NULL THEN
    RAISE EXCEPTION 'Seat ID, start time, and end time are required.';
  END IF;

  -- 3. Validate Chronology and Positive Duration
  IF p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'Booking end time must be strictly after start time.';
  END IF;

  v_duration_mins := pg_catalog.extract(epoch FROM (p_end_at - p_start_at)) / 60;
  IF v_duration_mins < 15 THEN
    RAISE EXCEPTION 'Minimum booking duration is 15 minutes.';
  END IF;

  -- 4. Reject Past Bookings (with 1-minute network latency tolerance)
  IF p_start_at < (v_now - INTERVAL '1 minute') THEN
    RAISE EXCEPTION 'Cannot book a time slot in the past.';
  END IF;

  -- 5. Lock and Verify Seat Existence and Status
  SELECT * INTO v_seat FROM public.seats WHERE id = p_seat_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seat not found.';
  END IF;

  IF v_seat.status <> 'available' THEN
    RAISE EXCEPTION 'This seat is currently % and cannot be reserved.', v_seat.status;
  END IF;

  -- 6. Verify Space Existence and Status
  SELECT * INTO v_space FROM public.spaces WHERE id = v_seat.space_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated study space not found.';
  END IF;

  IF v_space.status <> 'available' THEN
    RAISE EXCEPTION 'This space is currently % and unavailable for reservations.', v_space.status;
  END IF;

  -- 7. Validate Same-Day Session and Opening/Closing Hours
  IF (p_start_at::date) <> (p_end_at::date) THEN
    RAISE EXCEPTION 'Reservations must start and end on the same calendar day.';
  END IF;

  IF (p_start_at::time) < v_space.opening_time OR (p_end_at::time) > v_space.closing_time THEN
    RAISE EXCEPTION 'Booking time must be within space opening hours (% - %).', v_space.opening_time, v_space.closing_time;
  END IF;

  -- 8. Enforce Usage Rules (Max Duration and Advance Limits)
  SELECT * INTO v_rule FROM public.usage_rules WHERE space_id = v_space.id;
  IF FOUND THEN
    IF v_rule.max_booking_duration_minutes IS NOT NULL AND v_duration_mins > v_rule.max_booking_duration_minutes THEN
      RAISE EXCEPTION 'Booking duration of % minutes exceeds maximum allowed of % minutes.', v_duration_mins, v_rule.max_booking_duration_minutes;
    END IF;

    IF v_rule.advance_booking_limit_days IS NOT NULL AND p_start_at > (v_now + (v_rule.advance_booking_limit_days || ' days')::INTERVAL) THEN
      RAISE EXCEPTION 'Reservations can only be made up to % days in advance.', v_rule.advance_booking_limit_days;
    END IF;
  ELSE
    IF v_duration_mins > 720 THEN
      RAISE EXCEPTION 'Booking duration exceeds campus maximum of 12 hours.';
    END IF;
    IF p_start_at > (v_now + INTERVAL '14 days') THEN
      RAISE EXCEPTION 'Reservations can only be made up to 14 days in advance.';
    END IF;
  END IF;

  -- 9. Check Overlapping Active Bookings
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.bookings
  WHERE seat_id = p_seat_id
    AND status IN ('confirmed', 'checked_in')
    AND pg_catalog.tstzrange(start_at, end_at, '[)') && pg_catalog.tstzrange(p_start_at, p_end_at, '[)');

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'This seat is already reserved for the selected time window.';
  END IF;

  -- 10. Insert Booking
  INSERT INTO public.bookings (
    user_id,
    seat_id,
    space_id,
    start_at,
    end_at,
    status
  ) VALUES (
    v_user_id,
    p_seat_id,
    v_space.id,
    p_start_at,
    p_end_at,
    'confirmed'
  ) RETURNING * INTO v_new_booking;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'booking_id', v_new_booking.id,
    'seat_id', v_new_booking.seat_id,
    'space_id', v_new_booking.space_id,
    'start_at', v_new_booking.start_at,
    'end_at', v_new_booking.end_at,
    'status', v_new_booking.status
  );
END;
$$;

-- B. Check-in RPC
CREATE OR REPLACE FUNCTION public.check_in_booking(
  p_booking_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_admin BOOLEAN := false;
  v_booking RECORD;
  v_rule RECORD;
  v_now TIMESTAMPTZ := pg_catalog.now();
  v_window_mins INT := 15;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_is_admin := public.is_admin();

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;

  -- Validate ownership or admin authorization
  IF v_booking.user_id <> v_user_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized to check in for this booking.';
  END IF;

  -- Idempotency: return cleanly if already checked in
  IF v_booking.status = 'checked_in' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'message', 'Already checked in.',
      'status', 'checked_in'
    );
  END IF;

  IF v_booking.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Booking cannot be checked in because it is %.', v_booking.status;
  END IF;

  -- Validate check-in window for non-admins
  IF NOT v_is_admin THEN
    SELECT * INTO v_rule FROM public.usage_rules WHERE space_id = v_booking.space_id;
    IF FOUND AND v_rule.check_in_window_minutes IS NOT NULL THEN
      v_window_mins := v_rule.check_in_window_minutes;
    END IF;

    IF v_now < (v_booking.start_at - (v_window_mins || ' minutes')::INTERVAL) THEN
      RAISE EXCEPTION 'Check-in opens % minutes before your reservation starts.', v_window_mins;
    END IF;

    IF v_now > v_booking.end_at THEN
      RAISE EXCEPTION 'This reservation interval has expired.';
    END IF;
  END IF;

  -- Prevent duplicate occupancy log insertion
  IF NOT EXISTS (
    SELECT 1 FROM public.occupancy_logs
    WHERE booking_id = p_booking_id AND event_type = 'check_in'
  ) THEN
    INSERT INTO public.occupancy_logs (
      seat_id,
      user_id,
      booking_id,
      event_type,
      occurred_at,
      metadata
    ) VALUES (
      v_booking.seat_id,
      v_booking.user_id,
      p_booking_id,
      'check_in',
      v_now,
      pg_catalog.jsonb_build_object(
        'checked_in_by', v_user_id,
        'is_admin_override', v_is_admin
      )
    );
  END IF;

  -- Update booking state
  UPDATE public.bookings
  SET status = 'checked_in', updated_at = v_now
  WHERE id = p_booking_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'status', 'checked_in'
  );
END;
$$;

-- C. Check-out RPC
CREATE OR REPLACE FUNCTION public.check_out_booking(
  p_booking_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_admin BOOLEAN := false;
  v_booking RECORD;
  v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_is_admin := public.is_admin();

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;

  -- Validate ownership or admin authorization
  IF v_booking.user_id <> v_user_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized to check out this booking.';
  END IF;

  -- Idempotency: return cleanly if already completed
  IF v_booking.status = 'completed' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'message', 'Booking is already checked out.',
      'status', 'completed'
    );
  END IF;

  -- Students must be checked in to perform normal checkout
  IF NOT v_is_admin THEN
    IF v_booking.status <> 'checked_in' THEN
      RAISE EXCEPTION 'Cannot check out: booking status is % (must be checked_in).', v_booking.status;
    END IF;
  ELSE
    -- Admin override allows completing confirmed or checked_in bookings
    IF v_booking.status NOT IN ('confirmed', 'checked_in') THEN
      RAISE EXCEPTION 'Admin override failed: booking is already %.', v_booking.status;
    END IF;
  END IF;

  -- Update booking state
  UPDATE public.bookings
  SET status = 'completed', updated_at = v_now
  WHERE id = p_booking_id;

  -- Prevent duplicate checkout occupancy logs
  IF NOT EXISTS (
    SELECT 1 FROM public.occupancy_logs
    WHERE booking_id = p_booking_id AND event_type IN ('check_out', 'auto_checkout')
  ) THEN
    INSERT INTO public.occupancy_logs (
      seat_id,
      user_id,
      booking_id,
      event_type,
      occurred_at,
      metadata
    ) VALUES (
      v_booking.seat_id,
      v_booking.user_id,
      p_booking_id,
      CASE WHEN v_is_admin AND v_booking.user_id <> v_user_id THEN 'manual_override' ELSE 'check_out' END,
      v_now,
      pg_catalog.jsonb_build_object(
        'checked_out_by', v_user_id,
        'is_admin_override', v_is_admin
      )
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'status', 'completed'
  );
END;
$$;

-- D. Cancel Booking RPC
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_admin BOOLEAN := false;
  v_booking RECORD;
  v_rule RECORD;
  v_now TIMESTAMPTZ := pg_catalog.now();
  v_limit_mins INT := 15;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_is_admin := public.is_admin();

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;

  -- Validate ownership or admin authorization
  IF v_booking.user_id <> v_user_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized to cancel this booking.';
  END IF;

  -- Cannot cancel finalized bookings
  IF v_booking.status IN ('completed', 'cancelled', 'expired') THEN
    RAISE EXCEPTION 'Booking is already %.', v_booking.status;
  END IF;

  -- Students must cancel before cancellation_limit_minutes
  IF NOT v_is_admin THEN
    SELECT * INTO v_rule FROM public.usage_rules WHERE space_id = v_booking.space_id;
    IF FOUND AND v_rule.cancellation_limit_minutes IS NOT NULL THEN
      v_limit_mins := v_rule.cancellation_limit_minutes;
    END IF;

    IF v_now > (v_booking.start_at - (v_limit_mins || ' minutes')::INTERVAL) THEN
      RAISE EXCEPTION 'Cancellations must be made at least % minutes before reservation starts.', v_limit_mins;
    END IF;
  END IF;

  -- Update booking state
  UPDATE public.bookings
  SET status = 'cancelled', updated_at = v_now
  WHERE id = p_booking_id;

  -- Record proper cancellation event
  INSERT INTO public.occupancy_logs (
    seat_id,
    user_id,
    booking_id,
    event_type,
    occurred_at,
    metadata
  ) VALUES (
    v_booking.seat_id,
    v_booking.user_id,
    p_booking_id,
    'cancellation',
    v_now,
    pg_catalog.jsonb_build_object(
      'cancelled_by', v_user_id,
      'is_admin_override', v_is_admin
    )
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'status', 'cancelled'
  );
END;
$$;

-- 6. EXECUTION PERMISSIONS
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_profile_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_profile_update() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.check_space_seat_capacity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_space_seat_capacity() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_seat_booking(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_seat_booking(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.check_in_booking(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_in_booking(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.check_out_booking(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_out_booking(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.cancel_booking(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_booking(UUID) TO authenticated, service_role;



-- ========================================================================
-- FINAL HARDENING PATCH (safe to re-run)
-- ========================================================================

-- Private booking rows; use get_seat_availability for anonymous/student seat maps.
DROP POLICY IF EXISTS "Bookings are viewable by owner, admins, or active seat reservations" ON public.bookings;
DROP POLICY IF EXISTS "Bookings are private to owner and admins" ON public.bookings;
CREATE POLICY "Bookings are private to owner and admins" ON public.bookings
FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Explicitly preserve building_id when a zone is deleted.
ALTER TABLE public.spaces DROP CONSTRAINT IF EXISTS fk_spaces_zone_building;
ALTER TABLE public.spaces ADD CONSTRAINT fk_spaces_zone_building
FOREIGN KEY (zone_id, building_id) REFERENCES public.zones(id, building_id) ON DELETE SET NULL (zone_id);

-- A checked-in session must be checked out before cancellation.
CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user_id UUID := auth.uid(); v_is_admin BOOLEAN := public.is_admin(); v_booking RECORD; v_rule RECORD; v_now TIMESTAMPTZ := pg_catalog.now(); v_limit_mins INT := 15;
BEGIN
 IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
 SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found.'; END IF;
 IF v_booking.user_id <> v_user_id AND NOT v_is_admin THEN RAISE EXCEPTION 'Unauthorized to cancel this booking.'; END IF;
 IF v_booking.status = 'checked_in' THEN RAISE EXCEPTION 'A checked-in booking cannot be cancelled. Check it out first.'; END IF;
 IF v_booking.status <> 'confirmed' THEN RAISE EXCEPTION 'Booking cannot be cancelled because it is %.', v_booking.status; END IF;
 IF NOT v_is_admin THEN
   SELECT * INTO v_rule FROM public.usage_rules WHERE space_id = v_booking.space_id;
   IF FOUND AND v_rule.cancellation_limit_minutes IS NOT NULL THEN v_limit_mins := v_rule.cancellation_limit_minutes; END IF;
   IF v_now > (v_booking.start_at - (v_limit_mins || ' minutes')::INTERVAL) THEN RAISE EXCEPTION 'Cancellations must be made at least % minutes before reservation starts.', v_limit_mins; END IF;
 END IF;
 UPDATE public.bookings SET status = 'cancelled', updated_at = v_now WHERE id = p_booking_id;
 INSERT INTO public.occupancy_logs(seat_id,user_id,booking_id,event_type,occurred_at,metadata)
 VALUES(v_booking.seat_id,v_booking.user_id,p_booking_id,'cancellation',v_now,pg_catalog.jsonb_build_object('cancelled_by',v_user_id,'is_admin_override',v_is_admin));
 RETURN pg_catalog.jsonb_build_object('success',true,'status','cancelled');
END; $$;

-- Capacity-safe seat insert/reassignment and capacity reductions.
CREATE OR REPLACE FUNCTION public.check_space_seat_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_capacity INT; v_count INT;
BEGIN
 SELECT capacity INTO v_capacity FROM public.spaces WHERE id = NEW.space_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Space does not exist.'; END IF;
 SELECT COUNT(*) INTO v_count FROM public.seats WHERE space_id = NEW.space_id AND (TG_OP = 'INSERT' OR id <> NEW.id);
 IF v_count >= v_capacity THEN RAISE EXCEPTION 'Space capacity of % has been reached.',v_capacity; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_check_seat_capacity ON public.seats;
CREATE TRIGGER trg_check_seat_capacity BEFORE INSERT OR UPDATE OF space_id ON public.seats
FOR EACH ROW EXECUTE FUNCTION public.check_space_seat_capacity();

CREATE OR REPLACE FUNCTION public.check_space_capacity_reduction() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count INT;
BEGIN
 IF NEW.capacity < OLD.capacity THEN
  SELECT COUNT(*) INTO v_count FROM public.seats WHERE space_id = NEW.id;
  IF v_count > NEW.capacity THEN RAISE EXCEPTION 'Capacity cannot be reduced below current seat count (%).',v_count; END IF;
 END IF; RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_check_space_capacity_reduction ON public.spaces;
CREATE TRIGGER trg_check_space_capacity_reduction BEFORE UPDATE OF capacity ON public.spaces
FOR EACH ROW EXECUTE FUNCTION public.check_space_capacity_reduction();

-- Privacy-safe seat availability endpoint.
CREATE OR REPLACE FUNCTION public.get_seat_availability(p_space_id UUID,p_start_at TIMESTAMPTZ,p_end_at TIMESTAMPTZ)
RETURNS TABLE(seat_id UUID,seat_number TEXT,seat_status TEXT,is_reserved BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF p_space_id IS NULL OR p_start_at IS NULL OR p_end_at IS NULL OR p_end_at <= p_start_at THEN RAISE EXCEPTION 'A space and valid time interval are required.'; END IF;
 RETURN QUERY SELECT s.id,s.seat_number,s.status,EXISTS(SELECT 1 FROM public.bookings b WHERE b.seat_id=s.id AND b.status IN ('confirmed','checked_in') AND pg_catalog.tstzrange(b.start_at,b.end_at,'[)') && pg_catalog.tstzrange(p_start_at,p_end_at,'[)')) FROM public.seats s WHERE s.space_id=p_space_id ORDER BY s.seat_number;
END; $$;
REVOKE EXECUTE ON FUNCTION public.get_seat_availability(UUID,TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seat_availability(UUID,TIMESTAMPTZ,TIMESTAMPTZ) TO anon,authenticated;

-- Allow role changes only from a trusted SQL database session or an existing admin.
CREATE OR REPLACE FUNCTION public.handle_profile_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 NEW.id := OLD.id; NEW.email := OLD.email;
 IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() AND session_user NOT IN ('postgres','supabase_admin') THEN
  RAISE EXCEPTION 'Only an existing administrator or trusted database operator can change profile roles.';
 END IF;
 NEW.updated_at := pg_catalog.now(); RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.handle_profile_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_space_capacity_reduction() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_seat_availability(UUID,TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC;
