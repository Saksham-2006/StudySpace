
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import { requireStudent } from "@/lib/supabase/auth";
import LogoutButton from "@/components/auth/LogoutButton";

export default async function ProfilePage() {
  const { profile } = await requireStudent();

  return (
    <>
      <Navbar />

      <main className="profile-page wrap">
        <header className="profile-page__heading">
          <p className="tracked">YOUR ACCOUNT</p>
          <h1 className="h2">Welcome back.</h1>
          <p className="lead">
            Manage your Seat to Study account.
          </p>
        </header>

        <section className="profile-card">
          <p className="tracked">STUDENT PROFILE</p>

          <h2>{profile.full_name || "Student"}</h2>

          <p>{profile.email}</p>

          <span className="profile-role">
            {profile.role.toUpperCase()}
          </span>

          <div className="profile-actions">
            <Link href="/spaces" className="btn btn--sun">
              Explore spaces ↗
            </Link>

            <LogoutButton />
          </div>
        </section>
      </main>
    </>
  );
}
