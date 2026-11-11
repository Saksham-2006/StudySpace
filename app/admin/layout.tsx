import type { ReactNode } from "react";
import Link from "next/link";
import { LayoutDashboard, Armchair, BookOpen, BarChart3, ArrowLeft, Shield } from "lucide-react";
import { requireAdmin } from "@/lib/supabase/auth";

export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireAdmin();

  return (
    <div className="admin-layout">
      {/* Sidebar Navigation */}
      <aside className="admin-nav">
        <Link href="/admin" className="admin-nav__brand">
          <svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
            <circle cx="11" cy="10" r="8" fill="var(--sun)" />
            <path
              d="M3.6 16.5A9 9 0 0 1 6 3.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
          <span>Seat Admin</span>
        </Link>

        <div style={{ padding: "8px 12px", border: "1px solid color-mix(in oklab, var(--paper) 20%, transparent)", borderRadius: "6px", fontSize: "12px", color: "var(--soft-on-ink)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 600, color: "var(--sun)" }}>
            <Shield size={13} />
            <span>ADMINISTRATOR</span>
          </div>
          <div style={{ marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {profile.full_name || profile.email}
          </div>
        </div>

        <nav className="admin-nav__links">
          <Link href="/admin" className="admin-nav__item">
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </Link>

          <Link href="/admin/spaces" className="admin-nav__item">
            <Armchair size={18} />
            <span>Spaces & Seats</span>
          </Link>

          <Link href="/admin/bookings" className="admin-nav__item">
            <BookOpen size={18} />
            <span>Bookings & Occupancy</span>
          </Link>

          <Link href="/admin/analytics" className="admin-nav__item">
            <BarChart3 size={18} />
            <span>Analytics</span>
          </Link>
        </nav>

        <div style={{ marginTop: "auto", borderTop: "1px solid color-mix(in oklab, var(--paper) 15%, transparent)", paddingTop: "18px" }}>
          <Link
            href="/spaces"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--paper)",
              textDecoration: "none",
              fontSize: "13px",
            }}
          >
            <ArrowLeft size={16} />
            <span>Return to Student App</span>
          </Link>
        </div>
      </aside>

      {/* Admin Content Area */}
      <main className="admin-main">{children}</main>
    </div>
  );
}
