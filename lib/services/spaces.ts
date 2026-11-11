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

// Seed fallback spaces matching the Ochre visual identity and campus design
export const FALLBACK_SPACES: StudySpace[] = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    name: "Central Library",
    space_type: "Library",
    location: "Academic Block · Ground Floor",
    description: "A spacious academic environment for focused individual study.",
    capacity: 40,
    available_seats_count: 24,
    total_seats_count: 40,
    image_url: "https://images.unsplash.com/photo-1507842217343-583bb7270b66",
    opening_time: "07:00:00",
    closing_time: "23:00:00",
    status: "available",
    facilities: ["Wi-Fi", "Charging", "Silent zone"],
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    name: "The Quiet Room",
    space_type: "Quiet Zone",
    location: "Library · Second Floor",
    description: "A peaceful environment for uninterrupted concentration.",
    capacity: 20,
    available_seats_count: 13,
    total_seats_count: 20,
    image_url: "https://images.unsplash.com/photo-1497366754035-f200968a6e72",
    opening_time: "08:00:00",
    closing_time: "22:00:00",
    status: "available",
    facilities: ["Wi-Fi", "Silent zone"],
  },
  {
    id: "10000000-0000-0000-0000-000000000003",
    name: "Collaboration Hub",
    space_type: "Group Room",
    location: "Innovation Block · First Floor",
    description: "A collaborative space for group discussions and projects.",
    capacity: 8,
    available_seats_count: 5,
    total_seats_count: 8,
    image_url: "https://images.unsplash.com/photo-1497366811353-6870744d04b2",
    opening_time: "08:00:00",
    closing_time: "20:00:00",
    status: "available",
    facilities: ["Wi-Fi", "Display", "Whiteboard"],
  },
  {
    id: "10000000-0000-0000-0000-000000000004",
    name: "Digital Workspace",
    space_type: "Computer Lab",
    location: "Technology Block · Third Floor",
    description: "A dedicated workspace equipped for digital learning.",
    capacity: 30,
    available_seats_count: 18,
    total_seats_count: 30,
    image_url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085",
    opening_time: "08:00:00",
    closing_time: "21:00:00",
    status: "available",
    facilities: ["Computers", "Wi-Fi", "Charging"],
  },
  {
    id: "10000000-0000-0000-0000-000000000005",
    name: "Open Study Lounge",
    space_type: "Individual Desk",
    location: "Student Centre · First Floor",
    description: "A comfortable space for independent study and reading.",
    capacity: 24,
    available_seats_count: 14,
    total_seats_count: 24,
    image_url: "https://images.unsplash.com/photo-1497366216548-37526070297c",
    opening_time: "06:00:00",
    closing_time: "23:59:00",
    status: "available",
    facilities: ["Wi-Fi", "Charging"],
  },
  {
    id: "10000000-0000-0000-0000-000000000006",
    name: "Research Room",
    space_type: "Group Room",
    location: "Academic Block · Second Floor",
    description: "A smaller room suited to focused team research sessions.",
    capacity: 6,
    available_seats_count: 4,
    total_seats_count: 6,
    image_url: "https://images.unsplash.com/photo-1497366754035-f200968a6e72",
    opening_time: "08:00:00",
    closing_time: "20:00:00",
    status: "available",
    facilities: ["Wi-Fi", "Whiteboard"],
  },
];

export async function getBuildings(): Promise<Building[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("buildings")
      .select("id, name, description, location")
      .order("name");

    if (error || !data || data.length === 0) {
      return [
        { id: "b1", name: "Academic Block", description: "Main academic building", location: "North Campus" },
        { id: "b2", name: "Library Building", description: "Central repository and study floors", location: "Central Campus" },
        { id: "b3", name: "Technology Block", description: "Engineering and CS labs", location: "East Campus" },
        { id: "b4", name: "Student Centre", description: "Student recreation and lounge", location: "South Campus" },
        { id: "b5", name: "Innovation Block", description: "Research and group spaces", location: "West Campus" },
      ];
    }
    return data;
  } catch {
    return [
      { id: "b1", name: "Academic Block", description: "Main academic building", location: "North Campus" },
      { id: "b2", name: "Library Building", description: "Central repository and study floors", location: "Central Campus" },
      { id: "b3", name: "Technology Block", description: "Engineering and CS labs", location: "East Campus" },
      { id: "b4", name: "Student Centre", description: "Student recreation and lounge", location: "South Campus" },
      { id: "b5", name: "Innovation Block", description: "Research and group spaces", location: "West Campus" },
    ];
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
      return filterFallbackSpaces(filters);
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
    return filterFallbackSpaces(filters);
  }
}

function filterFallbackSpaces(filters?: {
  search?: string;
  buildingId?: string;
  spaceType?: string;
  onlyAvailable?: boolean;
}): StudySpace[] {
  let list = [...FALLBACK_SPACES];

  if (filters?.spaceType && filters.spaceType !== "All spaces") {
    list = list.filter((s) => s.space_type === filters.spaceType);
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.space_type.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        (s.location && s.location.toLowerCase().includes(q))
    );
  }

  if (filters?.onlyAvailable) {
    list = list.filter((s) => (s.available_seats_count ?? 0) > 0);
  }

  return list;
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
      const fallback = FALLBACK_SPACES.find(
        (s) => s.id === id || s.id.endsWith(id) || id === "1" || id === "2" || id === "3" || id === "4" || id === "5" || id === "6"
      );
      if (fallback) return fallback;
      const numIdx = parseInt(id, 10);
      if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= FALLBACK_SPACES.length) {
        return FALLBACK_SPACES[numIdx - 1];
      }
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
    const numIdx = parseInt(id, 10);
    if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= FALLBACK_SPACES.length) {
      return FALLBACK_SPACES[numIdx - 1];
    }
    return FALLBACK_SPACES.find((s) => s.id === id) || null;
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

    let seats: Seat[] = seatsData || [];

    // Fallback if seats table is not populated yet
    if (error || seats.length === 0) {
      const space = await getSpaceById(spaceId);
      const cap = space?.capacity || 20;
      seats = Array.from({ length: cap }, (_, i) => ({
        id: `seat-${spaceId}-${i + 1}`,
        space_id: spaceId,
        seat_number: `S${String(i + 1).padStart(2, "0")}`,
        seat_type: i < 4 ? "window" : "standard",
        status: "available" as const,
        row_label: String.fromCharCode(65 + Math.floor(i / 6)),
        column_number: (i % 6) + 1,
      }));
    }

    // Check bookings for this seat during the specified time window
    const targetStart = timeWindow?.startAt || new Date().toISOString();
    const targetEnd = timeWindow?.endAt || new Date(Date.now() + 2 * 3600 * 1000).toISOString();

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
    const space = await getSpaceById(spaceId);
    const cap = space?.capacity || 20;
    return Array.from({ length: cap }, (_, i) => ({
      id: `seat-${spaceId}-${i + 1}`,
      space_id: spaceId,
      seat_number: `S${String(i + 1).padStart(2, "0")}`,
      seat_type: "standard" as const,
      status: "available" as const,
      row_label: String.fromCharCode(65 + Math.floor(i / 6)),
      column_number: (i % 6) + 1,
      computed_state: i % 3 === 0 ? "reserved" : "available",
    }));
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
