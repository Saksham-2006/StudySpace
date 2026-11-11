import { Suspense } from "react";
import BookingManager from "@/components/admin/BookingManager";
import { getAllBookings } from "@/lib/services/admin";

export const instant = false;

async function BookingsContent() {
  const bookings = await getAllBookings();
  return <BookingManager initialBookings={bookings} />;
}

export default function AdminBookingsPage() {
  return (
    <Suspense fallback={<div>Loading bookings...</div>}>
      <BookingsContent />
    </Suspense>
  );
}
