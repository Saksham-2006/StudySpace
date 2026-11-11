import { NextResponse, type NextRequest } from "next/server";
import { createBooking, cancelBooking, checkInBooking, checkOutBooking } from "@/lib/services/bookings";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { seatId, spaceId, startAt, endAt } = body;

    if (!seatId || !spaceId || !startAt || !endAt) {
      return NextResponse.json(
        { error: "Missing required booking fields (seatId, spaceId, startAt, endAt)." },
        { status: 400 }
      );
    }

    const result = await createBooking({ seatId, spaceId, startAt, endAt });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, booking: result.booking }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, bookingId } = body;

    if (!action || !bookingId) {
      return NextResponse.json({ error: "Missing action or bookingId." }, { status: 400 });
    }

    let result;
    if (action === "check_in") {
      result = await checkInBooking(bookingId);
    } else if (action === "check_out") {
      result = await checkOutBooking(bookingId);
    } else if (action === "cancel") {
      result = await cancelBooking(bookingId);
    } else {
      return NextResponse.json({ error: `Unknown action '${action}'.` }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

