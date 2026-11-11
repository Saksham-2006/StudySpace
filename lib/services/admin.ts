import { createClient } from "@/lib/supabase/server";
import type { AdminAnalytics, Booking } from "@/lib/types/database";

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  try {
    const supabase = await createClient();

    // Buildings count
    const { count: bCount } = await supabase
      .from("buildings")
      .select("*", { count: "exact", head: true });

    // Spaces count & capacity
    const { data: spacesData } = await supabase
      .from("spaces")
      .select("id, name, capacity");

    const totalBuildings = bCount ?? 0;
    const totalSpaces = spacesData?.length || 0;
    const totalCapacity = spacesData?.reduce((acc, s) => acc + (s.capacity || 0), 0) || 0;

    // Total seats count
    const { count: sCount } = await supabase
      .from("seats")
      .select("*", { count: "exact", head: true });

    const totalSeats = (sCount !== null && sCount !== undefined && sCount > 0) ? sCount : totalCapacity;

    // Current active bookings
    const nowIso = new Date().toISOString();
    const { data: activeBookings } = await supabase
      .from("bookings")
      .select("id, status, space_id, seat_id, start_at, end_at")
      .in("status", ["confirmed", "checked_in"])
      .lte("start_at", nowIso)
      .gte("end_at", nowIso);

    const checkedInCount = activeBookings?.filter((b) => b.status === "checked_in").length || 0;
    const currentlyOccupied = checkedInCount;
    const activeReservations = activeBookings?.length || 0;
    const currentlyAvailable = Math.max(0, totalSeats - activeReservations);

    // Today's bookings
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString());

    // Daily booking trends (last 7 days) from real records
    const dailyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const { count: dayTotal } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .gte("created_at", dayStart.toISOString())
        .lte("created_at", dayEnd.toISOString());

      const { count: dayCheckins } = await supabase
        .from("occupancy_logs")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "check_in")
        .gte("occurred_at", dayStart.toISOString())
        .lte("occurred_at", dayEnd.toISOString());

      dailyTrend.push({
        date: dayStr,
        bookings: dayTotal ?? 0,
        checkIns: dayCheckins ?? 0,
      });
    }

    // Space utilisation calculation from actual active bookings
    const spaceUtilisation = (spacesData || []).map((sp) => {
      const spaceActive = activeBookings?.filter((b) => b.space_id === sp.id).length || 0;
      const rate = sp.capacity > 0 ? Math.round((spaceActive / sp.capacity) * 100) : 0;
      return {
        name: sp.name,
        capacity: sp.capacity,
        bookings: spaceActive,
        utilisationRate: Math.min(100, rate),
      };
    });

    // Real hourly occupancy distribution for today
    const hourSlots = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const { data: todayBookings } = await supabase
      .from("bookings")
      .select("start_at, end_at, status")
      .in("status", ["confirmed", "checked_in"])
      .gte("end_at", todayStart.toISOString())
      .lte("start_at", todayEnd.toISOString());

    const peakOccupancyHours = hourSlots.map((slot) => {
      const [h] = slot.split(":").map(Number);
      const slotTime = new Date(todayStart);
      slotTime.setHours(h, 0, 0, 0);

      const activeCount = todayBookings?.filter((b) => {
        const bStart = new Date(b.start_at);
        const bEnd = new Date(b.end_at);
        return slotTime >= bStart && slotTime < bEnd;
      }).length || 0;

      return { hour: slot, activeCount };
    });

    const weeklyUtilisationRate = totalSeats > 0 ? Math.min(100, Math.round((activeReservations / totalSeats) * 100)) : 0;

    return {
      totalBuildings,
      totalSpaces,
      totalSeats,
      currentlyAvailableSeats: currentlyAvailable,
      currentlyOccupiedSeats: currentlyOccupied,
      activeReservationsCount: activeReservations,
      dailyBookingsCount: todayCount ?? 0,
      weeklyUtilisationRate,
      dailyTrend,
      spaceUtilisation,
      peakOccupancyHours,
    };
  } catch {
    return {
      totalBuildings: 0,
      totalSpaces: 0,
      totalSeats: 0,
      currentlyAvailableSeats: 0,
      currentlyOccupiedSeats: 0,
      activeReservationsCount: 0,
      dailyBookingsCount: 0,
      weeklyUtilisationRate: 0,
      dailyTrend: [],
      spaceUtilisation: [],
      peakOccupancyHours: [
        { hour: "08:00", activeCount: 0 },
        { hour: "10:00", activeCount: 0 },
        { hour: "12:00", activeCount: 0 },
        { hour: "14:00", activeCount: 0 },
        { hour: "16:00", activeCount: 0 },
        { hour: "18:00", activeCount: 0 },
        { hour: "20:00", activeCount: 0 },
      ],
    };
  }
}

export async function getAllBookings(filters?: {
  status?: string;
  search?: string;
}): Promise<Booking[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("bookings")
      .select(`
        id,
        user_id,
        seat_id,
        space_id,
        start_at,
        end_at,
        status,
        created_at,
        spaces(id, name, space_type),
        seats(id, seat_number),
        profiles(id, full_name, email)
      `)
      .order("start_at", { ascending: false });

    if (filters?.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    type BookingRecord = {
      id: string;
      user_id: string;
      seat_id: string;
      space_id: string;
      start_at: string;
      end_at: string;
      status: Booking["status"];
      created_at: string;
      spaces?: Record<string, unknown>;
      seats?: Record<string, unknown>;
      profiles?: Record<string, unknown>;
    };

    return (data as unknown as BookingRecord[]).map((b) => ({
      id: b.id,
      user_id: b.user_id,
      seat_id: b.seat_id,
      space_id: b.space_id,
      start_at: b.start_at,
      end_at: b.end_at,
      status: b.status,
      created_at: b.created_at,
      space: b.spaces as unknown as Booking["space"],
      seat: b.seats as unknown as Booking["seat"],
      user: b.profiles as unknown as Booking["user"],
    }));
  } catch {
    return [];
  }
}

export async function adminCancelBooking(bookingId: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", bookingId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to cancel booking" };
  }
}
