import { NextResponse, type NextRequest } from "next/server";
import { getSpaceSeats } from "@/lib/services/spaces";
import { getSeatAvailability } from "@/lib/services/bookings";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get("spaceId");
    const startAt = searchParams.get("startAt");
    const endAt = searchParams.get("endAt");

    if (!spaceId || !startAt || !endAt) {
      return NextResponse.json(
        { error: "Query parameters 'spaceId', 'startAt', and 'endAt' are required." },
        { status: 400 }
      );
    }

    const seats = await getSpaceSeats(spaceId, { startAt, endAt });
    const rpcResult = await getSeatAvailability({ spaceId, startAt, endAt });

    return NextResponse.json({
      success: true,
      spaceId,
      startAt,
      endAt,
      seats,
      availability: rpcResult.seats,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch seat availability." },
      { status: 500 }
    );
  }
}

