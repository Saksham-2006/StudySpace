-- ========================================================================
-- SEAT TO STUDY — COMPREHENSIVE PRODUCTION DATABASE SCHEMA & MIGRATION
-- Run this in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 3. PROFILES TABLE & SECURITY TRIGGERS
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. HELPER FUNCTION: IS_ADMIN
-- Created after profiles so fresh provisioning has no forward relation dependency.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT p.role = 'admin' FROM public.profiles AS p WHERE p.id = auth.uid()),
    false
  );
$$;

-- Trigger: Automatically create or update profile on user signup
-- Enforces that all new signups default to 'student' to prevent privilege escalation
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Protect role, email, and id from unauthorized modification
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
    IF NOT public.is_admin()
       AND session_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Only an existing administrator or trusted database operator can change profile roles.';
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

-- 4. BUILDINGS TABLE
CREATE TABLE IF NOT EXISTS public.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT buildings_name_unique UNIQUE (name)
);

-- 5. ZONES TABLE
CREATE TABLE IF NOT EXISTS public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  floor_number INT NOT NULL DEFAULT 1,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT zones_building_name_unique UNIQUE (building_id, name),
  CONSTRAINT zones_id_building_id_unique UNIQUE (id, building_id)
);

-- 6. SPACES TABLE
CREATE TABLE IF NOT EXISTS public.spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES public.buildings(id) ON DELETE SET NULL,
  zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  space_type TEXT NOT NULL CHECK (space_type IN ('Library', 'Quiet Zone', 'Group Room', 'Computer Lab', 'Individual Desk', 'Collaborative Zone')),
  capacity INT NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  image_url TEXT,
  opening_time TIME NOT NULL DEFAULT '08:00:00',
  closing_time TIME NOT NULL DEFAULT '22:00:00',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'closed')),
  facilities TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT spaces_name_unique UNIQUE (name),
  CONSTRAINT spaces_valid_hours CHECK (closing_time > opening_time),
  CONSTRAINT fk_spaces_zone_building FOREIGN KEY (zone_id, building_id) REFERENCES public.zones(id, building_id) ON DELETE SET NULL (zone_id)
);

-- 7. SEATS TABLE
CREATE TABLE IF NOT EXISTS public.seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  seat_number TEXT NOT NULL,
  seat_type TEXT NOT NULL DEFAULT 'standard' CHECK (seat_type IN ('standard', 'standing', 'window', 'power_accessible', 'group')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'blocked')),
  row_label TEXT,
  column_number INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT seats_space_seat_number_unique UNIQUE (space_id, seat_number),
  CONSTRAINT seats_id_space_id_unique UNIQUE (id, space_id)
);

-- Capacity verification trigger: ensure seats count does not exceed space capacity
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
  -- Serialize inventory changes against the parent space row.
  SELECT capacity INTO v_capacity FROM public.spaces WHERE id = NEW.space_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Space does not exist.';
  END IF;
  SELECT COUNT(*) INTO v_current_count
  FROM public.seats
  WHERE space_id = NEW.space_id AND (TG_OP = 'INSERT' OR id <> NEW.id);
  IF v_current_count >= v_capacity THEN
    RAISE EXCEPTION 'Cannot add or move seat: space capacity of % has been reached.', v_capacity;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_seat_capacity ON public.seats;
CREATE TRIGGER trg_check_seat_capacity
  BEFORE INSERT OR UPDATE OF space_id ON public.seats
  FOR EACH ROW EXECUTE FUNCTION public.check_space_seat_capacity();

CREATE OR REPLACE FUNCTION public.check_space_capacity_reduction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count INT;
BEGIN
  IF NEW.capacity < OLD.capacity THEN
    SELECT COUNT(*) INTO v_count FROM public.seats WHERE space_id = NEW.id;
    IF v_count > NEW.capacity THEN
      RAISE EXCEPTION 'Capacity cannot be reduced below the current seat count (%).', v_count;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_check_space_capacity_reduction ON public.spaces;
CREATE TRIGGER trg_check_space_capacity_reduction
BEFORE UPDATE OF capacity ON public.spaces
FOR EACH ROW EXECUTE FUNCTION public.check_space_capacity_reduction();

-- 8. USAGE RULES TABLE
CREATE TABLE IF NOT EXISTS public.usage_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID REFERENCES public.spaces(id) ON DELETE CASCADE UNIQUE,
  max_booking_duration_minutes INT NOT NULL DEFAULT 240, -- 4 hours
  advance_booking_limit_days INT NOT NULL DEFAULT 7,      -- 7 days in advance
  cancellation_limit_minutes INT NOT NULL DEFAULT 15,     -- Up to 15m before start
  check_in_window_minutes INT NOT NULL DEFAULT 15,        -- Within 15m of start
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seat_id UUID NOT NULL REFERENCES public.seats(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'checked_in', 'completed', 'cancelled', 'no_show', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_booking_interval CHECK (end_at > start_at),
  CONSTRAINT fk_bookings_seat_space FOREIGN KEY (seat_id, space_id) REFERENCES public.seats(id, space_id) ON DELETE CASCADE
);

-- Double booking exclusion constraint using btree_gist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'no_overlapping_active_bookings'
  ) THEN
    ALTER TABLE public.bookings
    ADD CONSTRAINT no_overlapping_active_bookings
    EXCLUDE USING gist (
      seat_id WITH =,
      tstzrange(start_at, end_at, '[)') WITH &&
    ) WHERE (status IN ('confirmed', 'checked_in'));
  END IF;
END $$;

-- 10. OCCUPANCY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.occupancy_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_id UUID NOT NULL REFERENCES public.seats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('check_in', 'check_out', 'auto_checkout', 'no_show_cancellation', 'manual_override', 'cancellation')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 11. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_spaces_building ON public.spaces(building_id);
CREATE INDEX IF NOT EXISTS idx_spaces_zone ON public.spaces(zone_id);
CREATE INDEX IF NOT EXISTS idx_seats_space ON public.seats(space_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_seat ON public.bookings(seat_id);
CREATE INDEX IF NOT EXISTS idx_bookings_space ON public.bookings(space_id);
CREATE INDEX IF NOT EXISTS idx_bookings_interval ON public.bookings(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_occupancy_logs_booking ON public.occupancy_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_occupancy_logs_seat ON public.occupancy_logs(seat_id);

-- 12. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occupancy_logs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies (Non-recursive)
DROP POLICY IF EXISTS "Profiles are readable by owner and admins" ON public.profiles;
CREATE POLICY "Profiles are readable by owner and admins"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update their own profile name" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- Public Read Catalog Policies (Buildings, Zones, Spaces, Seats, Usage Rules)
DROP POLICY IF EXISTS "Public read buildings" ON public.buildings;
CREATE POLICY "Public read buildings" ON public.buildings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write buildings" ON public.buildings;
CREATE POLICY "Admin write buildings" ON public.buildings FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public read zones" ON public.zones;
CREATE POLICY "Public read zones" ON public.zones FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write zones" ON public.zones;
CREATE POLICY "Admin write zones" ON public.zones FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public read spaces" ON public.spaces;
CREATE POLICY "Public read spaces" ON public.spaces FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write spaces" ON public.spaces;
CREATE POLICY "Admin write spaces" ON public.spaces FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public read seats" ON public.seats;
CREATE POLICY "Public read seats" ON public.seats FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write seats" ON public.seats;
CREATE POLICY "Admin write seats" ON public.seats FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public read usage rules" ON public.usage_rules;
CREATE POLICY "Public read usage rules" ON public.usage_rules FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write usage rules" ON public.usage_rules;
CREATE POLICY "Admin write usage rules" ON public.usage_rules FOR ALL USING (public.is_admin());

-- Bookings Policies:
-- 1) SELECT: only owners and admins can read booking rows. Availability is exposed separately without personal data.
DROP POLICY IF EXISTS "Users view their own bookings or admins view all" ON public.bookings;
DROP POLICY IF EXISTS "Bookings are viewable by owner, admins, or active seat reservations" ON public.bookings;
CREATE POLICY "Bookings are private to owner and admins"
  ON public.bookings FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- 2) Direct INSERT blocked for non-admins (must use create_seat_booking RPC)
DROP POLICY IF EXISTS "Authenticated users create their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can insert bookings directly" ON public.bookings;
CREATE POLICY "Admins can insert bookings directly"
  ON public.bookings FOR INSERT
  WITH CHECK (public.is_admin());

-- 3) Direct UPDATE blocked for non-admins (must use lifecycle RPCs)
DROP POLICY IF EXISTS "Users can update own bookings or admins manage" ON public.bookings;
DROP POLICY IF EXISTS "Admins can update bookings directly" ON public.bookings;
CREATE POLICY "Admins can update bookings directly"
  ON public.bookings FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4) Direct DELETE restricted to admins
DROP POLICY IF EXISTS "Admins can delete bookings" ON public.bookings;
CREATE POLICY "Admins can delete bookings"
  ON public.bookings FOR DELETE
  USING (public.is_admin());

-- Occupancy Logs Policies:
-- 1) SELECT: Users view own occupancy events, admins view all
DROP POLICY IF EXISTS "Users view own occupancy or admins view all" ON public.occupancy_logs;
CREATE POLICY "Users view own occupancy or admins view all"
  ON public.occupancy_logs FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- 2) Direct INSERT blocked for non-admins (only trusted RPCs or admins)
DROP POLICY IF EXISTS "Allow authenticated create occupancy logs" ON public.occupancy_logs;
DROP POLICY IF EXISTS "Admins can insert occupancy logs directly" ON public.occupancy_logs;
CREATE POLICY "Admins can insert occupancy logs directly"
  ON public.occupancy_logs FOR INSERT
  WITH CHECK (public.is_admin());

-- 3) Management restricted to admins
DROP POLICY IF EXISTS "Admins can manage occupancy logs" ON public.occupancy_logs;
CREATE POLICY "Admins can manage occupancy logs"
  ON public.occupancy_logs FOR ALL
  USING (public.is_admin());

-- 13. STORED PROCEDURES / SECURE RPC FUNCTIONS

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

  v_duration_mins := CEIL(EXTRACT(EPOCH FROM (p_end_at - p_start_at)) / 60)::INT;
  IF EXTRACT(EPOCH FROM (p_end_at - p_start_at)) < 900 THEN
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
  IF ((p_start_at AT TIME ZONE COALESCE(NULLIF(pg_catalog.current_setting('app.campus_timezone', true), ''), 'Asia/Kolkata'))::date) <> ((p_end_at AT TIME ZONE COALESCE(NULLIF(pg_catalog.current_setting('app.campus_timezone', true), ''), 'Asia/Kolkata'))::date) THEN
    RAISE EXCEPTION 'Reservations must start and end on the same calendar day.';
  END IF;

  IF (p_start_at AT TIME ZONE COALESCE(NULLIF(pg_catalog.current_setting('app.campus_timezone', true), ''), 'Asia/Kolkata'))::time < v_space.opening_time OR (p_end_at AT TIME ZONE COALESCE(NULLIF(pg_catalog.current_setting('app.campus_timezone', true), ''), 'Asia/Kolkata'))::time > v_space.closing_time THEN
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

  -- Cancellation is only valid before check-in. Checked-in sessions must be checked out first.
  IF v_booking.status = 'checked_in' THEN
    RAISE EXCEPTION 'A checked-in booking cannot be cancelled. Check it out first.';
  END IF;
  IF v_booking.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Booking cannot be cancelled because it is %.', v_booking.status;
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

-- 13A. PRIVACY-SAFE AVAILABILITY RPC
-- Returns seat-level occupancy only; never exposes booking owner or booking identifiers.
CREATE OR REPLACE FUNCTION public.get_seat_availability(
  p_space_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ
)
RETURNS TABLE(seat_id UUID, seat_number TEXT, seat_status TEXT, is_reserved BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_space_id IS NULL OR p_start_at IS NULL OR p_end_at IS NULL OR p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'A space and valid time interval are required.';
  END IF;
  RETURN QUERY
  SELECT s.id, s.seat_number, s.status,
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.seat_id = s.id
        AND b.status IN ('confirmed', 'checked_in')
        AND pg_catalog.tstzrange(b.start_at, b.end_at, '[)') && pg_catalog.tstzrange(p_start_at, p_end_at, '[)')
    )
  FROM public.seats s
  WHERE s.space_id = p_space_id
  ORDER BY s.seat_number;
END;
$$;

-- 14. EXECUTION PERMISSIONS
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_seat_availability(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seat_availability(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated;
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

-- 15. IDEMPOTENT INITIAL CAMPUS DATA SEED
DO $$
DECLARE
  b_acad UUID;
  b_tech UUID;
  b_lib  UUID;
  b_stud UUID;
  b_inno UUID;

  z_acad_g UUID;
  z_acad_2 UUID;
  z_lib_2  UUID;
  z_inno_1 UUID;
  z_tech_3 UUID;
  z_stud_1 UUID;

  s1 UUID;
  s2 UUID;
  s3 UUID;
  s4 UUID;
  s5 UUID;
  s6 UUID;

  i INT;
BEGIN
  -- Insert or update Buildings
  INSERT INTO public.buildings (name, description, location)
  VALUES ('Academic Block', 'Main university academic complex', 'North Campus · Zone A')
  ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, location = EXCLUDED.location
  RETURNING id INTO b_acad;

  INSERT INTO public.buildings (name, description, location)
  VALUES ('Technology Block', 'Engineering and Computer Science building', 'East Campus · Zone C')
  ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, location = EXCLUDED.location
  RETURNING id INTO b_tech;

  INSERT INTO public.buildings (name, description, location)
  VALUES ('Central Library Building', 'Multi-level campus library and repository', 'Central Campus')
  ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, location = EXCLUDED.location
  RETURNING id INTO b_lib;

  INSERT INTO public.buildings (name, description, location)
  VALUES ('Student Centre', 'Student recreation and independent study hub', 'South Campus')
  ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, location = EXCLUDED.location
  RETURNING id INTO b_stud;

  INSERT INTO public.buildings (name, description, location)
  VALUES ('Innovation Block', 'Entrepreneurship, research and collaborative center', 'West Campus')
  ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, location = EXCLUDED.location
  RETURNING id INTO b_inno;

  -- Insert or update Zones
  INSERT INTO public.zones (building_id, name, floor_number, description)
  VALUES (b_acad, 'Ground Floor Commons', 0, 'Main concourse and study hall')
  ON CONFLICT (building_id, name) DO UPDATE SET floor_number = EXCLUDED.floor_number, description = EXCLUDED.description
  RETURNING id INTO z_acad_g;

  INSERT INTO public.zones (building_id, name, floor_number, description)
  VALUES (b_acad, 'Second Floor Wing B', 2, 'Research and seminar rooms')
  ON CONFLICT (building_id, name) DO UPDATE SET floor_number = EXCLUDED.floor_number, description = EXCLUDED.description
  RETURNING id INTO z_acad_2;

  INSERT INTO public.zones (building_id, name, floor_number, description)
  VALUES (b_lib, 'Second Floor Silent Wing', 2, 'Strictly silent reading zones')
  ON CONFLICT (building_id, name) DO UPDATE SET floor_number = EXCLUDED.floor_number, description = EXCLUDED.description
  RETURNING id INTO z_lib_2;

  INSERT INTO public.zones (building_id, name, floor_number, description)
  VALUES (b_inno, 'First Floor Labs', 1, 'Group collaboration pods and whiteboards')
  ON CONFLICT (building_id, name) DO UPDATE SET floor_number = EXCLUDED.floor_number, description = EXCLUDED.description
  RETURNING id INTO z_inno_1;

  INSERT INTO public.zones (building_id, name, floor_number, description)
  VALUES (b_tech, 'Third Floor Digital Labs', 3, 'High performance computing labs')
  ON CONFLICT (building_id, name) DO UPDATE SET floor_number = EXCLUDED.floor_number, description = EXCLUDED.description
  RETURNING id INTO z_tech_3;

  INSERT INTO public.zones (building_id, name, floor_number, description)
  VALUES (b_stud, 'First Floor Mezzanine', 1, 'Relaxed study desks with power access')
  ON CONFLICT (building_id, name) DO UPDATE SET floor_number = EXCLUDED.floor_number, description = EXCLUDED.description
  RETURNING id INTO z_stud_1;

  -- Insert or update Study Spaces
  INSERT INTO public.spaces (
    building_id, zone_id, name, description, space_type, capacity, image_url,
    opening_time, closing_time, status, facilities
  ) VALUES (
    b_acad, z_acad_g, 'Central Library',
    'A spacious academic environment for focused individual study.',
    'Library', 40,
    'https://images.unsplash.com/photo-1507842217343-583bb7270b66',
    '07:00:00', '23:00:00', 'available',
    ARRAY['Wi-Fi', 'Charging', 'Silent zone']
  ) ON CONFLICT (name) DO UPDATE SET
    building_id = EXCLUDED.building_id,
    zone_id = EXCLUDED.zone_id,
    description = EXCLUDED.description,
    space_type = EXCLUDED.space_type,
    capacity = EXCLUDED.capacity,
    image_url = EXCLUDED.image_url,
    opening_time = EXCLUDED.opening_time,
    closing_time = EXCLUDED.closing_time,
    status = EXCLUDED.status,
    facilities = EXCLUDED.facilities
  RETURNING id INTO s1;

  INSERT INTO public.spaces (
    building_id, zone_id, name, description, space_type, capacity, image_url,
    opening_time, closing_time, status, facilities
  ) VALUES (
    b_lib, z_lib_2, 'The Quiet Room',
    'A peaceful environment for uninterrupted concentration.',
    'Quiet Zone', 20,
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72',
    '08:00:00', '22:00:00', 'available',
    ARRAY['Wi-Fi', 'Silent zone']
  ) ON CONFLICT (name) DO UPDATE SET
    building_id = EXCLUDED.building_id,
    zone_id = EXCLUDED.zone_id,
    description = EXCLUDED.description,
    space_type = EXCLUDED.space_type,
    capacity = EXCLUDED.capacity,
    image_url = EXCLUDED.image_url,
    opening_time = EXCLUDED.opening_time,
    closing_time = EXCLUDED.closing_time,
    status = EXCLUDED.status,
    facilities = EXCLUDED.facilities
  RETURNING id INTO s2;

  INSERT INTO public.spaces (
    building_id, zone_id, name, description, space_type, capacity, image_url,
    opening_time, closing_time, status, facilities
  ) VALUES (
    b_inno, z_inno_1, 'Collaboration Hub',
    'A collaborative space for group discussions and projects.',
    'Group Room', 8,
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2',
    '08:00:00', '20:00:00', 'available',
    ARRAY['Wi-Fi', 'Display', 'Whiteboard']
  ) ON CONFLICT (name) DO UPDATE SET
    building_id = EXCLUDED.building_id,
    zone_id = EXCLUDED.zone_id,
    description = EXCLUDED.description,
    space_type = EXCLUDED.space_type,
    capacity = EXCLUDED.capacity,
    image_url = EXCLUDED.image_url,
    opening_time = EXCLUDED.opening_time,
    closing_time = EXCLUDED.closing_time,
    status = EXCLUDED.status,
    facilities = EXCLUDED.facilities
  RETURNING id INTO s3;

  INSERT INTO public.spaces (
    building_id, zone_id, name, description, space_type, capacity, image_url,
    opening_time, closing_time, status, facilities
  ) VALUES (
    b_tech, z_tech_3, 'Digital Workspace',
    'A dedicated workspace equipped for digital learning.',
    'Computer Lab', 30,
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085',
    '08:00:00', '21:00:00', 'available',
    ARRAY['Computers', 'Wi-Fi', 'Charging']
  ) ON CONFLICT (name) DO UPDATE SET
    building_id = EXCLUDED.building_id,
    zone_id = EXCLUDED.zone_id,
    description = EXCLUDED.description,
    space_type = EXCLUDED.space_type,
    capacity = EXCLUDED.capacity,
    image_url = EXCLUDED.image_url,
    opening_time = EXCLUDED.opening_time,
    closing_time = EXCLUDED.closing_time,
    status = EXCLUDED.status,
    facilities = EXCLUDED.facilities
  RETURNING id INTO s4;

  INSERT INTO public.spaces (
    building_id, zone_id, name, description, space_type, capacity, image_url,
    opening_time, closing_time, status, facilities
  ) VALUES (
    b_stud, z_stud_1, 'Open Study Lounge',
    'A comfortable space for independent study and reading.',
    'Individual Desk', 24,
    'https://images.unsplash.com/photo-1497366216548-37526070297c',
    '06:00:00', '23:59:00', 'available',
    ARRAY['Wi-Fi', 'Charging']
  ) ON CONFLICT (name) DO UPDATE SET
    building_id = EXCLUDED.building_id,
    zone_id = EXCLUDED.zone_id,
    description = EXCLUDED.description,
    space_type = EXCLUDED.space_type,
    capacity = EXCLUDED.capacity,
    image_url = EXCLUDED.image_url,
    opening_time = EXCLUDED.opening_time,
    closing_time = EXCLUDED.closing_time,
    status = EXCLUDED.status,
    facilities = EXCLUDED.facilities
  RETURNING id INTO s5;

  INSERT INTO public.spaces (
    building_id, zone_id, name, description, space_type, capacity, image_url,
    opening_time, closing_time, status, facilities
  ) VALUES (
    b_acad, z_acad_2, 'Research Room',
    'A smaller room suited to focused team research sessions.',
    'Group Room', 6,
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72',
    '08:00:00', '20:00:00', 'available',
    ARRAY['Wi-Fi', 'Whiteboard']
  ) ON CONFLICT (name) DO UPDATE SET
    building_id = EXCLUDED.building_id,
    zone_id = EXCLUDED.zone_id,
    description = EXCLUDED.description,
    space_type = EXCLUDED.space_type,
    capacity = EXCLUDED.capacity,
    image_url = EXCLUDED.image_url,
    opening_time = EXCLUDED.opening_time,
    closing_time = EXCLUDED.closing_time,
    status = EXCLUDED.status,
    facilities = EXCLUDED.facilities
  RETURNING id INTO s6;

  -- Insert or update Usage Rules
  INSERT INTO public.usage_rules (space_id, max_booking_duration_minutes, advance_booking_limit_days, cancellation_limit_minutes, check_in_window_minutes)
  VALUES
    (s1, 240, 7, 15, 20),
    (s2, 180, 5, 15, 20),
    (s3, 120, 3, 30, 15),
    (s4, 240, 7, 15, 20),
    (s5, 300, 7, 15, 30),
    (s6, 120, 3, 30, 15)
  ON CONFLICT (space_id) DO UPDATE SET
    max_booking_duration_minutes = EXCLUDED.max_booking_duration_minutes,
    advance_booking_limit_days = EXCLUDED.advance_booking_limit_days,
    cancellation_limit_minutes = EXCLUDED.cancellation_limit_minutes,
    check_in_window_minutes = EXCLUDED.check_in_window_minutes;

  -- Temporarily disable seat capacity trigger during idempotent seed insert
  ALTER TABLE public.seats DISABLE TRIGGER trg_check_seat_capacity;

  -- Populate Seats for Central Library (40 seats)
  FOR i IN 1..40 LOOP
    INSERT INTO public.seats (space_id, seat_number, seat_type, status, row_label, column_number)
    VALUES (s1, 'S' || LPAD(i::TEXT, 2, '0'), 'standard', 'available', CHR(65 + ((i - 1) / 6)), ((i - 1) % 6) + 1)
    ON CONFLICT (space_id, seat_number) DO UPDATE SET
      seat_type = EXCLUDED.seat_type,
      row_label = EXCLUDED.row_label,
      column_number = EXCLUDED.column_number;
  END LOOP;

  -- Populate Seats for The Quiet Room (20 seats)
  FOR i IN 1..20 LOOP
    INSERT INTO public.seats (space_id, seat_number, seat_type, status, row_label, column_number)
    VALUES (s2, 'S' || LPAD(i::TEXT, 2, '0'), CASE WHEN i <= 6 THEN 'window' ELSE 'standard' END, 'available', CHR(65 + ((i - 1) / 5)), ((i - 1) % 5) + 1)
    ON CONFLICT (space_id, seat_number) DO UPDATE SET
      seat_type = EXCLUDED.seat_type,
      row_label = EXCLUDED.row_label,
      column_number = EXCLUDED.column_number;
  END LOOP;

  -- Populate Seats for Collaboration Hub (8 seats)
  FOR i IN 1..8 LOOP
    INSERT INTO public.seats (space_id, seat_number, seat_type, status, row_label, column_number)
    VALUES (s3, 'S' || LPAD(i::TEXT, 2, '0'), 'group', 'available', 'Table 1', i)
    ON CONFLICT (space_id, seat_number) DO UPDATE SET
      seat_type = EXCLUDED.seat_type,
      row_label = EXCLUDED.row_label,
      column_number = EXCLUDED.column_number;
  END LOOP;

  -- Populate Seats for Digital Workspace (30 seats)
  FOR i IN 1..30 LOOP
    INSERT INTO public.seats (space_id, seat_number, seat_type, status, row_label, column_number)
    VALUES (s4, 'S' || LPAD(i::TEXT, 2, '0'), 'power_accessible', 'available', 'Bench ' || (((i - 1) / 6) + 1), ((i - 1) % 6) + 1)
    ON CONFLICT (space_id, seat_number) DO UPDATE SET
      seat_type = EXCLUDED.seat_type,
      row_label = EXCLUDED.row_label,
      column_number = EXCLUDED.column_number;
  END LOOP;

  -- Populate Seats for Open Study Lounge (24 seats)
  FOR i IN 1..24 LOOP
    INSERT INTO public.seats (space_id, seat_number, seat_type, status, row_label, column_number)
    VALUES (s5, 'S' || LPAD(i::TEXT, 2, '0'), 'standard', 'available', CHR(65 + ((i - 1) / 6)), ((i - 1) % 6) + 1)
    ON CONFLICT (space_id, seat_number) DO UPDATE SET
      seat_type = EXCLUDED.seat_type,
      row_label = EXCLUDED.row_label,
      column_number = EXCLUDED.column_number;
  END LOOP;

  -- Populate Seats for Research Room (6 seats)
  FOR i IN 1..6 LOOP
    INSERT INTO public.seats (space_id, seat_number, seat_type, status, row_label, column_number)
    VALUES (s6, 'S' || LPAD(i::TEXT, 2, '0'), 'group', 'available', 'Round Table', i)
    ON CONFLICT (space_id, seat_number) DO UPDATE SET
      seat_type = EXCLUDED.seat_type,
      row_label = EXCLUDED.row_label,
      column_number = EXCLUDED.column_number;
  END LOOP;

  ALTER TABLE public.seats ENABLE TRIGGER trg_check_seat_capacity;

END $$;
