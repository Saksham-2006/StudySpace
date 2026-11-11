import { createClient } from "@/lib/supabase/server";
import type { Booking, BookingStatus, StudySpace } from "@/lib/types/database";

export async function getUserBookings(userId: string): Promise<Booking[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
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
        spaces(id, name, space_type, image_url, buildings(name, location)),
        seats(id, seat_number, seat_type, row_label)
      `)
      .eq("user_id", userId)
      .order("start_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    type RawBooking = {
      id: string;
      user_id: string;
      seat_id: string;
      space_id: string;
      start_at: string;
      end_at: string;
      status: string;
      created_at: string;
      spaces?: {
        id: string;
        name: string;
        space_type: string;
        image_url: string | null;
        buildings?: { name: string; location: string | null } | null;
      };
      seats?: {
        id: string;
        seat_number: string;
        seat_type: string;
        row_label: string | null;
      };
    };

    return (data as unknown as RawBooking[]).map((b) => ({
      id: b.id,
      user_id: b.user_id,
      seat_id: b.seat_id,
      space_id: b.space_id,
      start_at: b.start_at,
      end_at: b.end_at,
      status: b.status as BookingStatus,
      created_at: b.created_at,
      space: b.spaces
        ? ({
            id: b.spaces.id,
            name: b.spaces.name,
            description: null,
            space_type: (b.spaces.space_type || "Library") as StudySpace["space_type"],
            image_url: b.spaces.image_url,
            capacity: 0,
            opening_time: "08:00:00",
            closing_time: "22:00:00",
            status: "available",
            facilities: [],
            location: b.spaces.buildings
              ? `${b.spaces.buildings.name} · ${b.spaces.buildings.location || ""}`
              : "Campus",
          } as StudySpace)
        : undefined,
      seat: b.seats as unknown as Booking["seat"],
    }));
  } catch {
    return [];
  }
}

export async function createBooking(params: {
  seatId: string;
  spaceId: string;
  startAt: string;
  endAt: string;
}): Promise<{ success: boolean; error?: string; booking?: Booking }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "Please sign in to complete your reservation." };
    }

    const start = new Date(params.startAt);
    const end = new Date(params.endAt);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { success: false, error: "Invalid booking dates provided." };
    }

    if (end <= start) {
      return { success: false, error: "Reservation end time must be after start time." };
    }

    if (start.getTime() < Date.now() - 5 * 60 * 1000) {
      return { success: false, error: "Cannot book a time slot in the past." };
    }

    // Execute trusted atomic booking RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc("create_seat_booking", {
      p_seat_id: params.seatId,
      p_start_at: params.startAt,
      p_end_at: params.endAt,
    });

    if (rpcError) {
      return { success: false, error: rpcError.message };
    }

    if (!rpcData?.success) {
      return { success: false, error: "Failed to create booking reservation." };
    }

    return {
      success: true,
      booking: {
        id: rpcData.booking_id,
        user_id: user.id,
        seat_id: rpcData.seat_id,
        space_id: rpcData.space_id,
        start_at: rpcData.start_at,
        end_at: rpcData.end_at,
        status: rpcData.status,
        created_at: new Date().toISOString(),
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected booking error occurred.",
    };
  }
}

export async function checkInBooking(
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc("check_in_booking", {
      p_booking_id: bookingId,
    });

    if (rpcError) {
      return { success: false, error: rpcError.message };
    }

    if (rpcData && !rpcData.success) {
      return { success: false, error: rpcData.message || "Failed to check in." };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to check in." };
  }
}

export async function checkOutBooking(
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc("check_out_booking", {
      p_booking_id: bookingId,
    });

    if (rpcError) {
      return { success: false, error: rpcError.message };
    }

    if (rpcData && !rpcData.success) {
      return { success: false, error: rpcData.message || "Failed to check out." };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to check out." };
  }
}

export async function cancelBooking(
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required." };
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc("cancel_booking", {
      p_booking_id: bookingId,
    });

    if (rpcError) {
      return { success: false, error: rpcError.message };
    }

    if (rpcData && !rpcData.success) {
      return { success: false, error: rpcData.message || "Failed to cancel booking." };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to cancel booking." };
  }
}

export async function getUserBookingStats(userId: string) {
  try {
    const bookings = await getUserBookings(userId);
    const total = bookings.length;
    const active = bookings.filter((b) => b.status === "confirmed" || b.status === "checked_in").length;
    const completed = bookings.filter((b) => b.status === "completed").length;
    const cancelled = bookings.filter((b) => b.status === "cancelled").length;

    // Approximate total study hours
    let totalMinutes = 0;
    bookings
      .filter((b) => b.status === "completed" || b.status === "checked_in")
      .forEach((b) => {
        const diff = new Date(b.end_at).getTime() - new Date(b.start_at).getTime();
        if (diff > 0) totalMinutes += diff / (1000 * 60);
      });

    return {
      totalBookings: total,
      activeBookings: active,
      completedBookings: completed,
      cancelledBookings: cancelled,
      totalHours: (totalMinutes / 60).toFixed(1),
    };
  } catch {
    return {
      totalBookings: 0,
      activeBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      totalHours: "0.0",
    };
  }
}
