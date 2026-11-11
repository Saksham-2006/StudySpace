import { Suspense } from "react";
import Navbar from "@/components/layout/Navbar";
import BookingsDashboard from "@/components/bookings/BookingsDashboard";
import { requireStudent } from "@/lib/supabase/auth";
import { getUserBookings } from "@/lib/services/bookings";

export const instant = false;

async function BookingsContent() {
  const { user } = await requireStudent();
  const bookings = await getUserBookings(user.id);
  return <BookingsDashboard initialBookings={bookings} />;
}

export default function BookingsPage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<div className="wrap" style={{ padding: "120px 0" }}>Loading bookings...</div>}>
        <BookingsContent />
      </Suspense>
    </>
  );
}
