"use client";

import { useState, useMemo } from "react";
import { Search, XCircle, CheckCircle, Loader2 } from "lucide-react";
import type { Booking } from "@/lib/types/database";

type BookingManagerProps = {
  initialBookings: Booking[];
};

export default function BookingManager({ initialBookings }: BookingManagerProps) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const q = search.toLowerCase();
      const studentMatch =
        !search ||
        (b.user?.full_name && b.user.full_name.toLowerCase().includes(q)) ||
        (b.user?.email && b.user.email.toLowerCase().includes(q)) ||
        (b.space?.name && b.space.name.toLowerCase().includes(q)) ||
        (b.seat?.seat_number && b.seat.seat_number.toLowerCase().includes(q));

      const statusMatch = statusFilter === "all" || b.status === statusFilter;

      return studentMatch && statusMatch;
    });
  }, [bookings, search, statusFilter]);

  const handleCancel = async (bookingId: string) => {
    if (!confirm("Are you sure you want to cancel this booking as an administrator?")) return;

    setCancellingId(bookingId);
    setMessage(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", bookingId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel.");

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: "cancelled" } : b))
      );

      setMessage({ text: "Booking cancelled successfully.", type: "success" });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Error cancelling booking.",
        type: "error",
      });
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <p className="tracked" style={{ color: "var(--rust)" }}>CAMPUS RESERVATIONS</p>
          <h1 className="h2" style={{ fontSize: "clamp(36px, 5vw, 64px)" }}>
            Bookings & Occupancy
          </h1>
        </div>

        <div>
          <span style={{ fontSize: "14px", color: "var(--sage)" }}>
            Showing <strong>{filteredBookings.length}</strong> of {bookings.length} records
          </span>
        </div>
      </div>

      {message && (
        <div
          role="status"
          style={{
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

      {/* Filter and Search Controls */}
      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginBottom: "24px" }}>
        <div style={{ flex: "1 1 280px", display: "flex", alignItems: "center", gap: "10px", padding: "0 16px", border: "1px solid color-mix(in oklab, var(--ink) 30%, transparent)", background: "transparent" }}>
          <Search size={18} color="var(--sage)" />
          <input
            type="search"
            placeholder="Search student, email, space or seat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "12px 0", border: 0, outline: 0, background: "transparent", font: "inherit" }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="spaces-select"
          style={{ minWidth: "180px" }}
        >
          <option value="all">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="checked_in">Checked In (Occupied)</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Bookings Table */}
      <div className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Student</th>
                <th>Study Space</th>
                <th>Seat</th>
                <th>Time Window</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((b) => {
                const isCancelling = cancellingId === b.id;
                const sDate = new Date(b.start_at);
                const eDate = new Date(b.end_at);

                return (
                  <tr key={b.id}>
                    <td style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--sage)" }}>
                      {b.id.slice(0, 8)}...
                    </td>
                    <td>
                      <strong>{b.user?.full_name || "Student"}</strong>
                      <div style={{ fontSize: "12px", color: "var(--sage)" }}>{b.user?.email}</div>
                    </td>
                    <td>{b.space?.name || "Space"}</td>
                    <td>
                      <strong>{b.seat?.seat_number || "Seat"}</strong>
                    </td>
                    <td style={{ fontSize: "13px" }}>
                      <div>{sDate.toLocaleDateString([], { month: "short", day: "numeric" })}</div>
                      <div style={{ color: "var(--sage)" }}>
                        {sDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – {eDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge status-badge--${b.status}`}>
                        {b.status === "checked_in" ? "Occupied" : b.status}
                      </span>
                    </td>
                    <td>
                      {b.status !== "cancelled" && b.status !== "completed" ? (
                        <button
                          type="button"
                          className="btn btn--paper"
                          style={{ padding: "6px 12px", fontSize: "12px" }}
                          disabled={isCancelling}
                          onClick={() => handleCancel(b.id)}
                        >
                          {isCancelling ? <Loader2 size={12} className="auth-spinner" /> : <XCircle size={12} />}
                          Cancel
                        </button>
                      ) : (
                        <span style={{ color: "var(--sage)", fontSize: "12px" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredBookings.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "36px", color: "var(--sage)" }}>
                    No bookings found matching current filters.
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
