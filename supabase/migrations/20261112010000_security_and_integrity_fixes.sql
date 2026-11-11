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
