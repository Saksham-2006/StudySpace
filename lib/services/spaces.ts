import { createClient } from "@/lib/supabase/server";
import type { StudySpace, Seat, UsageRule, Building } from "@/lib/types/database";

export type RawSpace = {
  id: string;
  building_id?: string | null;
  zone_id?: string | null;
  name: string;
  description?: string | null;
  space_type: StudySpace["space_type"];
  capacity: number;
  image_url: string | null;
  opening_time: string;
  closing_time: string;
  status: StudySpace["status"];
  facilities?: string[] | null;
  buildings?: { id: string; name: string; description?: string | null; location: string | null } | null;
  zones?: { id: string; name: string; floor_number: number } | null;
};

export async function getBuildings(): Promise<Building[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("buildings")
      .select("id, name, description, location")
      .order("name");

    if (error || !data) {
      return [];
    }
    return data;
  } catch {
    return [];
  }
}

export async function getSpaces(filters?: {
  search?: string;
  buildingId?: string;
  spaceType?: string;
  onlyAvailable?: boolean;
}): Promise<StudySpace[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("spaces")
      .select(`
        id,
        building_id,
        zone_id,
        name,
        description,
        space_type,
        capacity,
        image_url,
        opening_time,
        closing_time,
        status,
        facilities,
        buildings(id, name, location),
        zones(id, name, floor_number)
      `)
      .order("name");

    if (filters?.spaceType && filters.spaceType !== "All spaces") {
      query = query.eq("space_type", filters.spaceType);
    }

    if (filters?.buildingId && filters.buildingId !== "all") {
      query = query.eq("building_id", filters.buildingId);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return [];
    }

    // Fetch active bookings around now to compute available seats
    const nowIso = new Date().toISOString();
    const { data: activeBookings } = await supabase
      .from("bookings")
      .select("seat_id, space_id")
      .in("status", ["confirmed", "checked_in"])
      .lte("start_at", nowIso)
      .gte("end_at", nowIso);

    const activeMap = new Map<string, number>();
    activeBookings?.forEach((b) => {
      activeMap.set(b.space_id, (activeMap.get(b.space_id) || 0) + 1);
    });

    const spaces: StudySpace[] = (data as unknown as RawSpace[]).map((item) => {
      const activeCount = activeMap.get(item.id) || 0;
      const bldg = item.buildings ? `${item.buildings.name} · ${item.buildings.location || ""}` : null;
      const available = Math.max(0, item.capacity - activeCount);

      return {
        id: item.id,
        building_id: item.building_id,
        zone_id: item.zone_id,
        name: item.name,
        description: item.description,
        space_type: item.space_type,
        capacity: item.capacity,
        image_url: item.image_url,
        opening_time: item.opening_time,
        closing_time: item.closing_time,
        status: item.status,
        facilities: item.facilities || [],
        building: item.buildings || undefined,
        zone: item.zones || undefined,
        location: bldg || "Campus Building",
        available_seats_count: available,
        total_seats_count: item.capacity,
      };
    });

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      return spaces.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.space_type.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q)) ||
          (s.location && s.location.toLowerCase().includes(q))
      );
    }

    if (filters?.onlyAvailable) {
      return spaces.filter((s) => (s.available_seats_count ?? 0) > 0);
    }

    return spaces;
  } catch {
    return [];
  }
}

export async function getSpaceById(id: string): Promise<StudySpace | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("spaces")
      .select(`
        id,
        building_id,
        zone_id,
        name,
        description,
        space_type,
        capacity,
        image_url,
        opening_time,
        closing_time,
        status,
        facilities,
        buildings(id, name, location),
        zones(id, name, floor_number)
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }

    const raw = data as unknown as RawSpace;
    const bldg = raw.buildings
      ? `${raw.buildings.name} · ${raw.buildings.location || ""}`
      : "Campus";

    return {
      id: raw.id,
      building_id: raw.building_id,
      zone_id: raw.zone_id,
      name: raw.name,
      description: raw.description,
      space_type: raw.space_type,
      capacity: raw.capacity,
      image_url: raw.image_url,
      opening_time: raw.opening_time,
      closing_time: raw.closing_time,
      status: raw.status,
      facilities: raw.facilities || [],
      building: raw.buildings || undefined,
      zone: raw.zones || undefined,
      location: bldg,
      total_seats_count: raw.capacity,
    };
  } catch {
    return null;
  }
}

export async function getSpaceSeats(
  spaceId: string,
  timeWindow?: { startAt: string; endAt: string }
): Promise<Seat[]> {
  try {
    const supabase = await createClient();

    // Query seats from Supabase
    const { data: seatsData, error } = await supabase
      .from("seats")
      .select("id, space_id, seat_number, seat_type, status, row_label, column_number")
      .eq("space_id", spaceId)
      .order("seat_number");

    if (error || !seatsData || seatsData.length === 0) {
      return [];
    }

    const seats: Seat[] = seatsData;

    // Check bookings for this seat during the specified time window
    const targetStart = timeWindow?.startAt || new Date().toISOString();
    const targetEnd = timeWindow?.endAt || new Date(Date.now() + 2 * 3600 * 1000).toISOString();

    // Try privacy-safe availability RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_seat_availability", {
      p_space_id: spaceId,
      p_start_at: targetStart,
      p_end_at: targetEnd,
    });

    if (!rpcError && rpcData && Array.isArray(rpcData)) {
      const rpcMap = new Map<string, { is_reserved: boolean; seat_status: string }>();
      rpcData.forEach((r: { seat_id: string; is_reserved: boolean; seat_status: string }) => {
        rpcMap.set(r.seat_id, r);
      });

      return seats.map((seat) => {
        const r = rpcMap.get(seat.id);
        if (seat.status !== "available" || (r && r.seat_status !== "available")) {
          return { ...seat, computed_state: "unavailable" as const };
        }
        if (r && r.is_reserved) {
          return { ...seat, computed_state: "reserved" as const };
        }
        return { ...seat, computed_state: "available" as const };
      });
    }

    // Direct booking query fallback for server side
    const { data: bookingsData } = await supabase
      .from("bookings")
      .select("seat_id, status, start_at, end_at")
      .eq("space_id", spaceId)
      .in("status", ["confirmed", "checked_in"])
      .lt("start_at", targetEnd)
      .gt("end_at", targetStart);

    const bookingStatusMap = new Map<string, "checked_in" | "confirmed">();
    bookingsData?.forEach((b) => {
      bookingStatusMap.set(b.seat_id, b.status as "checked_in" | "confirmed");
    });

    return seats.map((seat) => {
      if (seat.status !== "available") {
        return { ...seat, computed_state: "unavailable" as const };
      }

      const activeBooking = bookingStatusMap.get(seat.id);
      if (activeBooking === "checked_in") {
        return { ...seat, computed_state: "occupied" as const };
      }
      if (activeBooking === "confirmed") {
        return { ...seat, computed_state: "reserved" as const };
      }

      return { ...seat, computed_state: "available" as const };
    });
  } catch {
    return [];
  }
}

export async function getSpaceUsageRules(spaceId: string): Promise<UsageRule> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("usage_rules")
      .select("*")
      .eq("space_id", spaceId)
      .single();

    if (data) return data;
  } catch {
    // Return standard defaults
  }

  return {
    id: `rule-${spaceId}`,
    space_id: spaceId,
    max_booking_duration_minutes: 240,
    advance_booking_limit_days: 7,
    cancellation_limit_minutes: 15,
    check_in_window_minutes: 20,
  };
}
