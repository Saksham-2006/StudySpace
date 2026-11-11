import { Suspense } from "react";
import Link from "next/link";
import {
  Clock,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import { getAdminAnalytics, getAllBookings } from "@/lib/services/admin";

export const instant = false;

async function DashboardContent() {
  const [analytics, recentBookings] = await Promise.all([
    getAdminAnalytics(),
    getAllBookings(),
  ]);

  return (
    <div>
      <div className="admin-header">
        <div>
          <p className="tracked" style={{ color: "var(--rust)" }}>CAMPUS OVERVIEW</p>
          <h1 className="h2" style={{ fontSize: "clamp(36px, 5vw, 64px)" }}>
            Admin Dashboard
          </h1>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/admin/spaces" className="btn btn--sun" style={{ padding: "10px 20px", fontSize: "14px" }}>
            Manage Spaces ↗
          </Link>
          <Link href="/admin/analytics" className="btn btn--paper" style={{ padding: "10px 20px", fontSize: "14px" }}>
            Full Analytics
          </Link>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <p className="tracked" style={{ fontSize: "10px", color: "var(--sage)" }}>TOTAL BUILDINGS</p>
          <p className="metric-card__value">{analytics.totalBuildings}</p>
          <p className="metric-card__sub">Across campus campuses</p>
        </div>

        <div className="metric-card">
          <p className="tracked" style={{ fontSize: "10px", color: "var(--sage)" }}>STUDY SPACES</p>
          <p className="metric-card__value">{analytics.totalSpaces}</p>
          <p className="metric-card__sub">Active bookable locations</p>
        </div>

        <div className="metric-card">
          <p className="tracked" style={{ fontSize: "10px", color: "var(--sage)" }}>TOTAL SEATS</p>
          <p className="metric-card__value">{analytics.totalSeats}</p>
          <p className="metric-card__sub">Individual study desks</p>
        </div>

        <div className="metric-card">
          <p className="tracked" style={{ fontSize: "10px", color: "#38633d" }}>AVAILABLE SEATS</p>
          <p className="metric-card__value" style={{ color: "#38633d" }}>
            {analytics.currentlyAvailableSeats}
          </p>
          <p className="metric-card__sub">Ready for walk-in or booking</p>
        </div>

        <div className="metric-card">
          <p className="tracked" style={{ fontSize: "10px", color: "var(--sun)" }}>OCCUPIED SEATS</p>
          <p className="metric-card__value" style={{ color: "var(--sun)" }}>
            {analytics.currentlyOccupiedSeats}
          </p>
          <p className="metric-card__sub">Students physically checked in</p>
        </div>

        <div className="metric-card">
          <p className="tracked" style={{ fontSize: "10px", color: "var(--rust)" }}>ACTIVE RESERVATIONS</p>
          <p className="metric-card__value" style={{ color: "var(--rust)" }}>
            {analytics.activeReservationsCount}
          </p>
          <p className="metric-card__sub">Confirmed for current window</p>
        </div>
      </div>

      {/* Two Column Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", marginBottom: "36px" }}>
        {/* Space Utilisation Snapshot */}
        <div className="admin-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
            <h3>Space Utilisation Rates</h3>
            <span style={{ fontSize: "13px", color: "var(--sage)" }}>Avg {analytics.weeklyUtilisationRate}%</span>
          </div>

          <div style={{ display: "grid", gap: "16px" }}>
            {analytics.spaceUtilisation.map((item) => (
              <div key={item.name}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                  <span><strong>{item.name}</strong> ({item.capacity} seats)</span>
                  <span style={{ fontWeight: 600 }}>{item.utilisationRate}%</span>
                </div>
                <div style={{ width: "100%", height: "8px", background: "color-mix(in oklab, var(--ink) 12%, transparent)", borderRadius: "4px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${item.utilisationRate}%`,
                      height: "100%",
                      background: item.utilisationRate > 75 ? "var(--rust)" : "var(--sun)",
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Occupancy Tracking Logic Note */}
        <div className="admin-card">
          <h3>Occupancy vs Reservation</h3>
          <p style={{ color: "var(--sage)", fontSize: "14px", lineHeight: 1.6, marginBottom: "20px" }}>
            The platform enforces a strict separation between <strong>reservations</strong> (slots held in advance) and <strong>actual occupancy</strong> (verified check-in events logged in the audit stream).
          </p>

          <div style={{ display: "grid", gap: "12px", fontSize: "13px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", border: "1px solid color-mix(in oklab, var(--ink) 15%, transparent)" }}>
              <ShieldCheck size={18} color="var(--sun)" />
              <div>
                <strong>Check-In Window:</strong> Opens 20m before reservation start.
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", border: "1px solid color-mix(in oklab, var(--ink) 15%, transparent)" }}>
              <Clock size={18} color="var(--rust)" />
              <div>
                <strong>Missed Check-in:</strong> Unclaimed seats are automatically flagged.
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", border: "1px solid color-mix(in oklab, var(--ink) 15%, transparent)" }}>
              <TrendingUp size={18} color="#38633d" />
              <div>
                <strong>Auditable Logs:</strong> Every check-in/out event is stored with timestamps.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Bookings Table */}
      <div className="admin-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3>Recent Bookings</h3>
          <Link href="/admin/bookings" style={{ color: "var(--rust)", fontSize: "14px", fontWeight: 600 }}>
            View All ({recentBookings.length}) ↗
          </Link>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Space</th>
                <th>Seat</th>
                <th>Time Window</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.slice(0, 6).map((b) => (
                <tr key={b.id}>
                  <td>
                    <strong>{b.user?.full_name || "Student"}</strong>
                    <div style={{ fontSize: "12px", color: "var(--sage)" }}>{b.user?.email}</div>
                  </td>
                  <td>{b.space?.name || "Space"}</td>
                  <td>
                    <strong>{b.seat?.seat_number || "Seat"}</strong>
                  </td>
                  <td style={{ fontSize: "13px" }}>
                    {new Date(b.start_at).toLocaleDateString([], { month: "short", day: "numeric" })} · {new Date(b.start_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td>
                    <span className={`status-badge status-badge--${b.status}`}>
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
              {recentBookings.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--sage)" }}>
                    No bookings recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<div>Loading dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
