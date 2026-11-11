import { Suspense } from "react";
import Navbar from "@/components/layout/Navbar";
import ProfileManager from "@/components/profile/ProfileManager";
import { requireStudent } from "@/lib/supabase/auth";
import { getUserBookingStats } from "@/lib/services/bookings";

export const instant = false;

async function ProfileContent() {
  const { profile, user } = await requireStudent();
  const stats = await getUserBookingStats(user.id);
  return <ProfileManager profile={profile} stats={stats} />;
}

export default function ProfilePage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<div className="wrap" style={{ padding: "120px 0" }}>Loading profile...</div>}>
        <ProfileContent />
      </Suspense>
    </>
  );
}
