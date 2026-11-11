-- ========================================================================
-- SEAT TO STUDY — COMPREHENSIVE PRODUCTION DATABASE SCHEMA & MIGRATION
-- Run this in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 2. PROFILES TABLE & AUTH TRIGGER
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to automatically create or update profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'student'
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      email = EXCLUDED.email,
      updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. BUILDINGS TABLE
CREATE TABLE IF NOT EXISTS public.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. ZONES TABLE
CREATE TABLE IF NOT EXISTS public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  floor_number INT NOT NULL DEFAULT 1,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. SPACES TABLE
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. SEATS TABLE
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
  CONSTRAINT seats_space_seat_number_unique UNIQUE (space_id, seat_number)
);

-- 7. USAGE RULES TABLE
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

-- 8. BOOKINGS TABLE
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
  CONSTRAINT valid_booking_interval CHECK (end_at > start_at)
);

-- Exclusion constraint preventing double booking on the same seat for overlapping intervals
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

-- 9. OCCUPANCY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.occupancy_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_id UUID NOT NULL REFERENCES public.seats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('check_in', 'check_out', 'auto_checkout', 'no_show_cancellation', 'manual_override')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 10. INDEXES FOR PERFORMANCE
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

-- 11. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occupancy_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
DROP POLICY IF EXISTS "Profiles are readable by owner and admins" ON public.profiles;
CREATE POLICY "Profiles are readable by owner and admins"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update their own profile name" ON public.profiles;
CREATE POLICY "Users can update their own profile name"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (public.is_admin() OR role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
  );

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

-- Bookings Policies
DROP POLICY IF EXISTS "Users view their own bookings or admins view all" ON public.bookings;
CREATE POLICY "Users view their own bookings or admins view all"
  ON public.bookings FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Authenticated users create their own bookings" ON public.bookings;
CREATE POLICY "Authenticated users create their own bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own bookings or admins manage" ON public.bookings;
CREATE POLICY "Users can update own bookings or admins manage"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin());

-- Occupancy Logs Policies
DROP POLICY IF EXISTS "Users view own occupancy or admins view all" ON public.occupancy_logs;
CREATE POLICY "Users view own occupancy or admins view all"
  ON public.occupancy_logs FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Allow authenticated create occupancy logs" ON public.occupancy_logs;
CREATE POLICY "Allow authenticated create occupancy logs"
  ON public.occupancy_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 12. STORED PROCEDURES / RPC FUNCTIONS

-- A. Atomic Seat Booking Procedure
CREATE OR REPLACE FUNCTION public.create_seat_booking(
  p_seat_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_seat RECORD;
  v_space RECORD;
  v_rule RECORD;
  v_conflict_count INT;
  v_duration_mins INT;
  v_new_booking RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'Booking end time must be after start time.';
  END IF;

  IF p_start_at < now() - INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'Cannot book a slot in the past.';
  END IF;

  v_duration_mins := EXTRACT(EPOCH FROM (p_end_at - p_start_at)) / 60;

  -- Lock seat row to serialize booking attempts
  SELECT * INTO v_seat FROM public.seats WHERE id = p_seat_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seat not found.';
  END IF;

  IF v_seat.status <> 'available' THEN
    RAISE EXCEPTION 'This seat is currently % and cannot be reserved.', v_seat.status;
  END IF;

  -- Get space details
  SELECT * INTO v_space FROM public.spaces WHERE id = v_seat.space_id;
  IF NOT FOUND OR v_space.status <> 'available' THEN
    RAISE EXCEPTION 'The requested space is not available.';
  END IF;

  -- Check space usage rules
  SELECT * INTO v_rule FROM public.usage_rules WHERE space_id = v_space.id;
  IF FOUND THEN
    IF v_duration_mins > v_rule.max_booking_duration_minutes THEN
      RAISE EXCEPTION 'Booking duration exceeds maximum allowed of % minutes.', v_rule.max_booking_duration_minutes;
    END IF;

    IF p_start_at > (now() + (v_rule.advance_booking_limit_days || ' days')::INTERVAL) THEN
      RAISE EXCEPTION 'Reservations can only be made up to % days in advance.', v_rule.advance_booking_limit_days;
    END IF;
  END IF;

  -- Check for existing overlapping active booking
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.bookings
  WHERE seat_id = p_seat_id
    AND status IN ('confirmed', 'checked_in')
    AND tstzrange(start_at, end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)');

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'This seat is already reserved for the selected time window.';
  END IF;

  -- Insert booking
  INSERT INTO public.bookings (user_id, seat_id, space_id, start_at, end_at, status)
  VALUES (v_user_id, p_seat_id, v_space.id, p_start_at, p_end_at, 'confirmed')
  RETURNING * INTO v_new_booking;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_new_booking.id,
    'seat_id', v_new_booking.seat_id,
    'space_id', v_new_booking.space_id,
    'start_at', v_new_booking.start_at,
    'end_at', v_new_booking.end_at,
    'status', v_new_booking.status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Check-in RPC
CREATE OR REPLACE FUNCTION public.check_in_booking(
  p_booking_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking RECORD;
  v_rule RECORD;
  v_now TIMESTAMPTZ := now();
  v_window_mins INT := 20;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;

  IF v_booking.user_id <> v_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized to check in for this booking.';
  END IF;

  IF v_booking.status = 'checked_in' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already checked in.', 'status', 'checked_in');
  END IF;

  IF v_booking.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Booking cannot be checked in because it is %.', v_booking.status;
  END IF;

  -- Check rules
  SELECT * INTO v_rule FROM public.usage_rules WHERE space_id = v_booking.space_id;
  IF FOUND AND v_rule.check_in_window_minutes IS NOT NULL THEN
    v_window_mins := v_rule.check_in_window_minutes;
  END IF;

  -- Can check in within window before start up to end of booking
  IF v_now < (v_booking.start_at - (v_window_mins || ' minutes')::INTERVAL) THEN
    RAISE EXCEPTION 'Check-in opens % minutes before your reservation starts.', v_window_mins;
  END IF;

  IF v_now > v_booking.end_at THEN
    RAISE EXCEPTION 'This reservation interval has expired.';
  END IF;

  -- Update booking
  UPDATE public.bookings
  SET status = 'checked_in', updated_at = v_now
  WHERE id = p_booking_id;

  -- Record occupancy log
  INSERT INTO public.occupancy_logs (seat_id, user_id, booking_id, event_type, occurred_at)
  VALUES (v_booking.seat_id, v_booking.user_id, p_booking_id, 'check_in', v_now);

  RETURN jsonb_build_object('success', true, 'status', 'checked_in');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. Check-out RPC
CREATE OR REPLACE FUNCTION public.check_out_booking(
  p_booking_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;

  IF v_booking.user_id <> v_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized to check out this booking.';
  END IF;

  IF v_booking.status NOT IN ('confirmed', 'checked_in') THEN
    RAISE EXCEPTION 'Booking is already %.', v_booking.status;
  END IF;

  UPDATE public.bookings
  SET status = 'completed', updated_at = v_now
  WHERE id = p_booking_id;

  INSERT INTO public.occupancy_logs (seat_id, user_id, booking_id, event_type, occurred_at)
  VALUES (v_booking.seat_id, v_booking.user_id, p_booking_id, 'check_out', v_now);

  RETURN jsonb_build_object('success', true, 'status', 'completed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- D. Cancel Booking RPC
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;

  IF v_booking.user_id <> v_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized to cancel this booking.';
  END IF;

  IF v_booking.status IN ('completed', 'cancelled', 'expired') THEN
    RAISE EXCEPTION 'Booking is already %.', v_booking.status;
  END IF;

  UPDATE public.bookings
  SET status = 'cancelled', updated_at = v_now
  WHERE id = p_booking_id;

  INSERT INTO public.occupancy_logs (seat_id, user_id, booking_id, event_type, occurred_at)
  VALUES (v_booking.seat_id, v_booking.user_id, p_booking_id, 'manual_override', v_now);

  RETURN jsonb_build_object('success', true, 'status', 'cancelled');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. SEED INITIAL CAMPUS DATA
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
  -- Insert Buildings
  INSERT INTO public.buildings (name, description, location)
  VALUES ('Academic Block', 'Main university academic complex', 'North Campus · Zone A')
  RETURNING id INTO b_acad;

  INSERT INTO public.buildings (name, description, location)
  VALUES ('Technology Block', 'Engineering and Computer Science building', 'East Campus · Zone C')
  RETURNING id INTO b_tech;

  INSERT INTO public.buildings (name, description, location)
  VALUES ('Central Library Building', 'Multi-level campus library and repository', 'Central Campus')
  RETURNING id INTO b_lib;

  INSERT INTO public.buildings (name, description, location)
  VALUES ('Student Centre', 'Student recreation and independent study hub', 'South Campus')
  RETURNING id INTO b_stud;

  INSERT INTO public.buildings (name, description, location)
  VALUES ('Innovation Block', 'Entrepreneurship, research and collaborative center', 'West Campus')
  RETURNING id INTO b_inno;

  -- Insert Zones
  INSERT INTO public.zones (building_id, name, floor_number, description)
  VALUES (b_acad, 'Ground Floor Commons', 0, 'Main concourse and study hall')
  RETURNING id INTO z_acad_g;

  INSERT INTO public.zones (building_id, name, floor_number, description)
  VALUES (b_acad, 'Second Floor Wing B', 2, 'Research and seminar rooms')
  RETURNING id INTO z_acad_2;

  INSERT INTO public.zones (building_id, name, floor_number, description)
  VALUES (b_lib, 'Second Floor Silent Wing', 2, 'Strictly silent reading zones')
  RETURNING id INTO z_lib_2;

  INSERT INTO public.zones (building_id, name, floor_number, description)
  VALUES (b_inno, 'First Floor Labs', 1, 'Group collaboration pods and whiteboards')
  RETURNING id INTO z_inno_1;

  INSERT INTO public.zones (building_id, name, floor_number, description)
  VALUES (b_tech, 'Third Floor Digital Labs', 3, 'High performance computing labs')
  RETURNING id INTO z_tech_3;

  INSERT INTO public.zones (building_id, name, floor_number, description)
  VALUES (b_stud, 'First Floor Mezzanine', 1, 'Relaxed study desks with power access')
  RETURNING id INTO z_stud_1;

  -- Insert 6 Study Spaces
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
  ) RETURNING id INTO s1;

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
  ) RETURNING id INTO s2;

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
  ) RETURNING id INTO s3;

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
  ) RETURNING id INTO s4;

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
  ) RETURNING id INTO s5;

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
  ) RETURNING id INTO s6;

  -- Insert Usage Rules for Each Space
  INSERT INTO public.usage_rules (space_id, max_booking_duration_minutes, advance_booking_limit_days, cancellation_limit_minutes, check_in_window_minutes)
  VALUES
    (s1, 240, 7, 15, 20),
    (s2, 180, 5, 15, 20),
    (s3, 120, 3, 30, 15),
    (s4, 240, 7, 15, 20),
    (s5, 300, 7, 15, 30),
    (s6, 120, 3, 30, 15);

  -- Populate Seats for Central Library (40 seats)
  FOR i IN 1..40 LOOP
    INSERT INTO public.seats (space_id, seat_number, seat_type, status, row_label, column_number)
    VALUES (s1, 'S' || LPAD(i::TEXT, 2, '0'), 'standard', 'available', CHR(65 + ((i - 1) / 6)), ((i - 1) % 6) + 1);
  END LOOP;

  -- Populate Seats for The Quiet Room (20 seats)
  FOR i IN 1..20 LOOP
    INSERT INTO public.seats (space_id, seat_number, seat_type, status, row_label, column_number)
    VALUES (s2, 'S' || LPAD(i::TEXT, 2, '0'), CASE WHEN i <= 6 THEN 'window' ELSE 'standard' END, 'available', CHR(65 + ((i - 1) / 5)), ((i - 1) % 5) + 1);
  END LOOP;

  -- Populate Seats for Collaboration Hub (8 seats)
  FOR i IN 1..8 LOOP
    INSERT INTO public.seats (space_id, seat_number, seat_type, status, row_label, column_number)
    VALUES (s3, 'S' || LPAD(i::TEXT, 2, '0'), 'group', 'available', 'Table 1', i);
  END LOOP;

  -- Populate Seats for Digital Workspace (30 seats)
  FOR i IN 1..30 LOOP
    INSERT INTO public.seats (space_id, seat_number, seat_type, status, row_label, column_number)
    VALUES (s4, 'S' || LPAD(i::TEXT, 2, '0'), 'power_accessible', 'available', 'Bench ' || (((i - 1) / 6) + 1), ((i - 1) % 6) + 1);
  END LOOP;

  -- Populate Seats for Open Study Lounge (24 seats)
  FOR i IN 1..24 LOOP
    INSERT INTO public.seats (space_id, seat_number, seat_type, status, row_label, column_number)
    VALUES (s5, 'S' || LPAD(i::TEXT, 2, '0'), 'standard', 'available', CHR(65 + ((i - 1) / 6)), ((i - 1) % 6) + 1);
  END LOOP;

  -- Populate Seats for Research Room (6 seats)
  FOR i IN 1..6 LOOP
    INSERT INTO public.seats (space_id, seat_number, seat_type, status, row_label, column_number)
    VALUES (s6, 'S' || LPAD(i::TEXT, 2, '0'), 'group', 'available', 'Round Table', i);
  END LOOP;

END $$;

