"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Shield, BookOpen, CheckCircle, Edit3, Loader2 } from "lucide-react";
import LogoutButton from "@/components/auth/LogoutButton";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/lib/supabase/auth";

type ProfileManagerProps = {
  profile: UserProfile;
  stats: {
    totalBookings: number;
    activeBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    totalHours: string;
  };
};

export default function ProfileManager({ profile, stats }: ProfileManagerProps) {
  const [fullName, setFullName] = useState(profile.full_name || "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;

      setMessage({ text: "Profile updated successfully.", type: "success" });
      setEditing(false);
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Failed to update profile.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wrap profile-page">
      <header className="profile-page__heading">
        <p className="tracked">STUDENT ACCOUNT</p>
        <h1 className="h2">Account Profile</h1>
        <p className="lead">
          Manage your personal details, review study stats, and manage reservations.
        </p>
      </header>

      {message && (
        <div
          role="status"
          style={{
            maxWidth: "680px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px",
            marginBottom: "24px",
            border: `1px solid ${message.type === "success" ? "#38633d" : "#9a2d22"}`,
            background: message.type === "success" ? "color-mix(in oklab, #38633d 12%, transparent)" : "color-mix(in oklab, #9a2d22 12%, transparent)",
            color: message.type === "success" ? "#38633d" : "#9a2d22",
            fontSize: "14px",
          }}
        >
          <CheckCircle size={18} />
          <span>{message.text}</span>
        </div>
      )}

      {/* Booking Statistics Grid */}
      <div
        style={{
          maxWidth: "680px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "14px",
          marginBottom: "32px",
        }}
      >
        <div style={{ padding: "18px", border: "1px solid color-mix(in oklab, var(--ink) 25%, transparent)", background: "color-mix(in oklab, var(--paper) 95%, white)" }}>
          <p className="tracked" style={{ fontSize: "10px", color: "var(--rust)" }}>TOTAL BOOKINGS</p>
          <p style={{ fontFamily: "var(--f-display)", fontSize: "36px", fontWeight: 200, margin: "6px 0 0" }}>
            {stats.totalBookings}
          </p>
        </div>

        <div style={{ padding: "18px", border: "1px solid color-mix(in oklab, var(--ink) 25%, transparent)", background: "color-mix(in oklab, var(--paper) 95%, white)" }}>
          <p className="tracked" style={{ fontSize: "10px", color: "var(--sun)" }}>ACTIVE SESSIONS</p>
          <p style={{ fontFamily: "var(--f-display)", fontSize: "36px", fontWeight: 200, margin: "6px 0 0" }}>
            {stats.activeBookings}
          </p>
        </div>

        <div style={{ padding: "18px", border: "1px solid color-mix(in oklab, var(--ink) 25%, transparent)", background: "color-mix(in oklab, var(--paper) 95%, white)" }}>
          <p className="tracked" style={{ fontSize: "10px", color: "#38633d" }}>COMPLETED</p>
          <p style={{ fontFamily: "var(--f-display)", fontSize: "36px", fontWeight: 200, margin: "6px 0 0" }}>
            {stats.completedBookings}
          </p>
        </div>

        <div style={{ padding: "18px", border: "1px solid color-mix(in oklab, var(--ink) 25%, transparent)", background: "color-mix(in oklab, var(--paper) 95%, white)" }}>
          <p className="tracked" style={{ fontSize: "10px", color: "var(--khaki)" }}>STUDY HOURS</p>
          <p style={{ fontFamily: "var(--f-display)", fontSize: "36px", fontWeight: 200, margin: "6px 0 0" }}>
            {stats.totalHours}h
          </p>
        </div>
      </div>

      {/* Profile Card */}
      <section className="profile-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p className="tracked">PERSONAL INFORMATION</p>
            <h2>{fullName || "Student"}</h2>
            <p style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
              <Mail size={15} color="var(--sage)" />
              {profile.email}
            </p>
          </div>

          <button
            type="button"
            className="ibtn"
            style={{ width: "40px", height: "40px" }}
            onClick={() => setEditing(!editing)}
            aria-label="Edit Profile"
          >
            <Edit3 size={16} />
          </button>
        </div>

        <div style={{ marginTop: "16px" }}>
          <span className="profile-role">
            <Shield size={12} style={{ display: "inline", marginRight: "6px" }} />
            ROLE: {profile.role.toUpperCase()}
          </span>
        </div>

        {editing && (
          <form onSubmit={handleUpdateProfile} style={{ marginTop: "28px", borderTop: "1px solid color-mix(in oklab, var(--ink) 20%, transparent)", paddingTop: "20px" }}>
            <label style={{ display: "grid", gap: "8px", fontSize: "14px", fontWeight: 600 }}>
              Full Name
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{
                  padding: "12px 16px",
                  border: "1px solid var(--ink)",
                  background: "transparent",
                  font: "inherit",
                }}
                required
              />
            </label>

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button type="submit" className="btn btn--sun" disabled={saving}>
                {saving ? <Loader2 size={15} className="auth-spinner" /> : "Save Changes"}
              </button>
              <button type="button" className="btn btn--paper" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="profile-actions">
          <Link href="/bookings" className="btn btn--sun">
            <BookOpen size={16} />
            My Bookings ↗
          </Link>

          <Link href="/spaces" className="btn btn--paper">
            Explore Spaces
          </Link>

          {profile.role === "admin" && (
            <Link
              href="/admin"
              className="btn"
              style={{ background: "var(--ink)", color: "var(--sun)" }}
            >
              Admin Suite ↗
            </Link>
          )}

          <LogoutButton />
        </div>
      </section>
    </div>
  );
}
