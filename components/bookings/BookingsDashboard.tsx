"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  LogOut,
  XCircle,
  Armchair,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { Booking, BookingStatus } from "@/lib/types/database";

type BookingsDashboardProps = {
  initialBookings: Booking[];
};

export default function BookingsDashboard({ initialBookings }: BookingsDashboardProps) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [activeTab, setActiveTab] = useState<"upcoming" | "history">("upcoming");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const upcomingBookings = bookings.filter(
    (b) => b.status === "confirmed" || b.status === "checked_in"
  );
  const historyBookings = bookings.filter(
    (b) => b.status === "completed" || b.status === "cancelled" || b.status === "no_show" || b.status === "expired"
  );

  const displayList = activeTab === "upcoming" ? upcomingBookings : historyBookings;

  const handleAction = async (bookingId: string, action: "check_in" | "check_out" | "cancel") => {
    setLoadingId(bookingId);
    setMessage(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, bookingId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Operation failed. Try again");
      }

      // Update state locally
      setBookings((prev) =>
        prev.map((b) => {
          if (b.id !== bookingId) return b;
          let newStatus: BookingStatus = b.status;
          if (action === "check_in") newStatus = "checked_in";
          if (action === "check_out") newStatus = "completed";
          if (action === "cancel") newStatus = "cancelled";
          return { ...b, status: newStatus };
        })
      );

      const msg =
        action === "check_in"
          ? "Successfully Checked In! Your seat occupancy is recorded."
          : action === "check_out"
            ? "Checked out. Thank you for releasing your Study Seat!"
            : "Reservation cancelled.";
      setMessage({ text: msg, type: "success" });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Action failed. Please try again.",
        type: "error",
      });
    } finally {
      setLoadingId(null);
    }
  };

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case "confirmed":
        return <span className="status-badge status-badge--confirmed">Reserved</span>;
      case "checked_in":
        return <span className="status-badge status-badge--checked_in">Occupied (Checked In)</span>;
      case "completed":
        return <span className="status-badge status-badge--completed">Completed</span>;
      case "cancelled":
        return <span className="status-badge status-badge--cancelled">Cancelled</span>;
      default:
        return <span className="status-badge status-badge--completed">{status}</span>;
    }
  };

  const formatTimeRange = (startIso: string, endIso: string) => {
    const s = new Date(startIso);
    const e = new Date(endIso);
    const dateStr = s.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const timeStr = `${s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${e.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    return { dateStr, timeStr };
  };

  return (
    <div className="wrap bookings-page">
      <header className="bookings-page__header">
        <p className="tracked">YOUR STUDY RESERVATIONS</p>
        <h1 className="h2">My Bookings</h1>
        <p className="lead" style={{ color: "var(--sage)", marginTop: "12px" }}>
          Manage your reserved study desks, check in upon arrival, and check out when finished.
        </p>
      </header>

      {message && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px",
            marginBottom: "28px",
            border: `1px solid ${message.type === "success" ? "#38633d" : "#9a2d22"}`,
            background: message.type === "success" ? "color-mix(in oklab, #38633d 12%, transparent)" : "color-mix(in oklab, #9a2d22 12%, transparent)",
            color: message.type === "success" ? "#38633d" : "#9a2d22",
            fontSize: "14px",
          }}
        >
          {message.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="bookings-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "upcoming"}
          className={`tab-btn ${activeTab === "upcoming" ? "is-active" : ""}`}
          onClick={() => setActiveTab("upcoming")}
        >
          Active & Upcoming ({upcomingBookings.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "history"}
          className={`tab-btn ${activeTab === "history" ? "is-active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          History & Past ({historyBookings.length})
        </button>
      </div>

      {/* Bookings List */}
      {displayList.length > 0 ? (
        <div className="bookings-grid">
          {displayList.map((booking) => {
            const { dateStr, timeStr } = formatTimeRange(booking.start_at, booking.end_at);
            const isLoading = loadingId === booking.id;

            return (
              <article key={booking.id} className="booking-card">
                <div>
                  <div className="booking-card__top">
                    <div>
                      <p className="tracked" style={{ fontSize: "11px", color: "var(--rust)" }}>
                        {booking.space?.space_type || "Study Space"}
                      </p>
                      <h3 style={{ fontFamily: "var(--f-display)", fontSize: "24px", fontWeight: 300, margin: "4px 0" }}>
                        {booking.space?.name || "Campus Space"}
                      </h3>
                    </div>
                    {getStatusBadge(booking.status)}
                  </div>

                  <p style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--sage)", fontSize: "13px", marginTop: "8px" }}>
                    <MapPin size={14} />
                    {booking.space?.location || "Campus Building"}
                  </p>

                  <div style={{ display: "grid", gap: "6px", marginTop: "16px", fontSize: "13px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Armchair size={15} color="var(--sun)" />
                      <span>Seat: <strong>{booking.seat?.seat_number || "Reserved Desk"}</strong></span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Calendar size={15} color="var(--sun)" />
                      <span>{dateStr}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Clock size={15} color="var(--sun)" />
                      <span>{timeStr}</span>
                    </div>
                  </div>
                </div>

                <div className="booking-card__actions">
                  {booking.status === "confirmed" && (
                    <>
                      <button
                        type="button"
                        className="btn btn--sun"
                        style={{ padding: "8px 18px", fontSize: "13px" }}
                        disabled={isLoading}
                        onClick={() => handleAction(booking.id, "check_in")}
                      >
                        {isLoading ? <Loader2 size={14} className="auth-spinner" /> : <CheckCircle size={14} />}
                        Check In
                      </button>

                      <button
                        type="button"
                        className="btn btn--paper"
                        style={{ padding: "8px 16px", fontSize: "13px" }}
                        disabled={isLoading}
                        onClick={() => handleAction(booking.id, "cancel")}
                      >
                        <XCircle size={14} />
                        Cancel
                      </button>
                    </>
                  )}

                  {booking.status === "checked_in" && (
                    <button
                      type="button"
                      className="btn btn--sun"
                      style={{ padding: "8px 18px", fontSize: "13px" }}
                      disabled={isLoading}
                      onClick={() => handleAction(booking.id, "check_out")}
                    >
                      {isLoading ? <Loader2 size={14} className="auth-spinner" /> : <LogOut size={14} />}
                      Check Out & Release Seat
                    </button>
                  )}

                  {(booking.status === "completed" || booking.status === "cancelled") && (
                    <Link
                      href={`/spaces/${booking.space_id}`}
                      className="btn btn--paper"
                      style={{ padding: "8px 16px", fontSize: "13px" }}
                    >
                      Book Again ↗
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="spaces-empty">
          <h3>
            {activeTab === "upcoming"
              ? "No active or upcoming reservations."
              : "No past booking history."}
          </h3>
          <p style={{ color: "var(--sage)" }}>
            {activeTab === "upcoming"
              ? "You haven't reserved any study seats yet. Find an available desk and book your slot."
              : "Completed and cancelled bookings will appear here."}
          </p>
          <Link href="/spaces" className="btn btn--sun">
            Explore Study Spaces ↗
          </Link>
        </div>
      )}
    </div>
  );
}

