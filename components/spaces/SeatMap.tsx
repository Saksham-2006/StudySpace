"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Check, Armchair, Clock, Calendar, AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import type { Seat, UsageRule } from "@/lib/types/database";
import { useRealtimeBookings } from "@/lib/hooks/useRealtimeBookings";

type SeatMapProps = {
  spaceId: string;
  spaceName: string;
  capacity: number;
  initialSeats?: Seat[];
  usageRule?: UsageRule;
};

export default function SeatMap({
  spaceId,
  spaceName,
  capacity,
  initialSeats,
  usageRule,
}: SeatMapProps) {
  // Date and Time slots
  const dateOptions = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 4 }, (_, i) => {
      const d = new Date();
      d.setDate(today.getDate() + i);
      const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const iso = d.toISOString().split("T")[0];
      return { label, isoDate: iso, dateObj: d };
    });
  }, []);

  const [selectedDateIdx, setSelectedDateIdx] = useState(0);

  // Time slot options (2-hour blocks)
  const timeSlots = [
    { id: "slot-1", label: "08:00 – 10:00", startHour: 8, endHour: 10 },
    { id: "slot-2", label: "10:00 – 12:00", startHour: 10, endHour: 12 },
    { id: "slot-3", label: "12:00 – 14:00", startHour: 12, endHour: 14 },
    { id: "slot-4", label: "14:00 – 16:00", startHour: 14, endHour: 16 },
    { id: "slot-5", label: "16:00 – 18:00", startHour: 16, endHour: 18 },
    { id: "slot-6", label: "18:00 – 20:00", startHour: 18, endHour: 20 },
    { id: "slot-7", label: "20:00 – 22:00", startHour: 20, endHour: 22 },
  ];

  const [selectedSlotIdx, setSelectedSlotIdx] = useState(1);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<boolean>(false);

  const defaultSeats: Seat[] = useMemo(() => {
    if (initialSeats && initialSeats.length > 0) {
      return initialSeats;
    }

    const safeCapacity = Math.max(1, Math.floor(capacity));
    return Array.from({ length: safeCapacity }, (_, index) => {
      const seatNum = `S${String(index + 1).padStart(2, "0")}`;
      const isWindow = index < 6;
      const isOcc = index % 5 === 1;
      const isRes = index % 7 === 2;

      let state: "available" | "reserved" | "occupied" | "unavailable" = "available";
      if (isOcc) state = "occupied";
      else if (isRes) state = "reserved";

      return {
        id: `seat-${spaceId}-${index + 1}`,
        space_id: spaceId,
        seat_number: seatNum,
        seat_type: isWindow ? "window" : "standard",
        status: "available",
        row_label: String.fromCharCode(65 + Math.floor(index / 6)),
        column_number: (index % 6) + 1,
        computed_state: state,
      };
    });
  }, [initialSeats, capacity, spaceId]);

  const [seats, setSeats] = useState<Seat[]>(defaultSeats);

  // Realtime subscription for live seat availability changes
  const handleBookingChange = useCallback((payload: unknown) => {
    const data = payload as { new?: { seat_id?: string; status?: string } };
    if (!data?.new?.seat_id) return;
    const { seat_id, status } = data.new;
    setSeats((prev) =>
      prev.map((s) => {
        if (s.id !== seat_id) return s;
        let nextState: "available" | "reserved" | "occupied" | "unavailable" = "available";
        if (status === "checked_in") nextState = "occupied";
        else if (status === "confirmed") nextState = "reserved";
        else if (status === "cancelled" || status === "completed") nextState = "available";
        return { ...s, computed_state: nextState };
      })
    );
  }, []);

  useRealtimeBookings(spaceId, handleBookingChange);

  const availableCount = seats.filter(
    (s) => s.computed_state === "available"
  ).length;

  const activeDate = dateOptions[selectedDateIdx];
  const activeSlot = timeSlots[selectedSlotIdx];

  const calculateInterval = () => {
    const start = new Date(activeDate.dateObj);
    start.setHours(activeSlot.startHour, 0, 0, 0);

    const end = new Date(activeDate.dateObj);
    end.setHours(activeSlot.endHour, 0, 0, 0);

    return {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    };
  };

  const handleOpenBookingModal = () => {
    if (!selectedSeat) return;
    setBookingError(null);
    setBookingSuccess(false);
    setModalOpen(true);
  };

  const handleConfirmReservation = async () => {
    if (!selectedSeat) return;
    setBookingLoading(true);
    setBookingError(null);

    const { startAt, endAt } = calculateInterval();

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seatId: selectedSeat.id,
          spaceId: spaceId,
          startAt,
          endAt,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to reserve seat.");
      }

      setBookingSuccess(true);
      const bookedSeatId = selectedSeat.id;
      setSeats((prev) =>
        prev.map((s) => (s.id === bookedSeatId ? { ...s, computed_state: "reserved" } : s))
      );
    } catch (err) {
      setBookingError(
        err instanceof Error ? err.message : "Reservation failed. Please try again."
      );
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <section className="seat-selection">
      <div className="seat-selection__heading">
        <div>
          <p className="tracked">REAL-TIME RESERVATION</p>
          <h2 className="h2">Select your seat.</h2>
        </div>

        <p className="seat-selection__count">
          {availableCount} of {seats.length} seats available
        </p>
      </div>

      {/* Date & Time Slot Selector */}
      <div className="booking-time-picker">
        <h4>1. Choose Day & Time Window</h4>
        <div style={{ display: "grid", gap: "16px" }}>
          <div>
            <span style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "8px" }}>
              Date
            </span>
            <div className="time-slots">
              {dateOptions.map((opt, i) => (
                <button
                  key={opt.isoDate}
                  type="button"
                  className={`slot-pill ${selectedDateIdx === i ? "is-active" : ""}`}
                  onClick={() => {
                    setSelectedDateIdx(i);
                    setSelectedSeat(null);
                  }}
                >
                  <Calendar size={13} style={{ display: "inline", marginRight: "6px" }} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "8px" }}>
              Time Slot (2 Hours)
            </span>
            <div className="time-slots">
              {timeSlots.map((slot, i) => (
                <button
                  key={slot.id}
                  type="button"
                  className={`slot-pill ${selectedSlotIdx === i ? "is-active" : ""}`}
                  onClick={() => {
                    setSelectedSlotIdx(i);
                    setSelectedSeat(null);
                  }}
                >
                  <Clock size={13} style={{ display: "inline", marginRight: "6px" }} />
                  {slot.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Visual State Legend */}
      <div className="seat-legend">
        <span>
          <i className="legend-available" />
          Available
        </span>

        <span>
          <i className="legend-selected" />
          Selected
        </span>

        <span>
          <i className="legend-reserved" />
          Reserved
        </span>

        <span>
          <i className="legend-occupied" />
          Occupied (In Use)
        </span>

        <span>
          <i className="legend-unavailable" />
          Unavailable
        </span>
      </div>

      {/* Seat Grid Map */}
      <div className="seat-map">
        <div className="seat-map__screen">FRONT / PRESENTATION AREA</div>

        <div className="seat-map__grid">
          {seats.map((seat) => {
            const isSelected = selectedSeat?.id === seat.id;
            const state = seat.computed_state || "available";
            const isAvailable = state === "available";

            let stateClass = "";
            if (state === "occupied") stateClass = "is-occupied";
            else if (state === "reserved") stateClass = "is-reserved";
            else if (state === "unavailable") stateClass = "is-unavailable";
            else if (isSelected) stateClass = "is-selected";

            return (
              <button
                key={seat.id}
                type="button"
                disabled={!isAvailable}
                aria-label={`Seat ${seat.seat_number}, ${isSelected ? "selected" : state}`}
                aria-pressed={isSelected}
                className={`seat ${stateClass}`}
                onClick={() => {
                  if (isSelected) {
                    setSelectedSeat(null);
                  } else {
                    setSelectedSeat(seat);
                  }
                }}
              >
                {isSelected ? (
                  <Check size={17} />
                ) : (
                  <Armchair size={17} />
                )}

                <span>{seat.seat_number}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="seat-selection__footer">
        <p>
          {selectedSeat
            ? `Seat ${selectedSeat.seat_number} selected for ${activeDate.label} (${activeSlot.label}).`
            : "Choose an available seat to reserve your session."}
        </p>

        <button
          type="button"
          className="btn btn--sun"
          disabled={!selectedSeat}
          onClick={handleOpenBookingModal}
        >
          Reserve Seat {selectedSeat ? selectedSeat.seat_number : ""} ↗
        </button>
      </div>

      {/* Booking Confirmation Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => !bookingLoading && setModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="modal-card__header">
                <p className="tracked">CONFIRM RESERVATION</p>
                <h3>{spaceName}</h3>
              </div>
              <button
                type="button"
                className="ibtn"
                style={{ width: "36px", height: "36px" }}
                onClick={() => setModalOpen(false)}
                disabled={bookingLoading}
              >
                <X size={18} />
              </button>
            </div>

            {bookingSuccess ? (
              <div style={{ padding: "20px 0", textAlign: "center" }}>
                <CheckCircle2 size={54} color="var(--sun)" style={{ margin: "0 auto 16px" }} />
                <h4 style={{ fontFamily: "var(--f-display)", fontSize: "28px", fontWeight: 300, marginBottom: "12px" }}>
                  Reservation Confirmed!
                </h4>
                <p style={{ color: "var(--sage)", marginBottom: "28px", fontSize: "14px" }}>
                  Your seat <strong>{selectedSeat?.seat_number}</strong> is successfully booked for {activeDate.label} at {activeSlot.label}. You can check in upon arrival at the study space.
                </p>
                <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                  <Link href="/bookings" className="btn btn--sun">
                    View My Bookings ↗
                  </Link>
                  <button
                    type="button"
                    className="btn btn--paper"
                    onClick={() => {
                      setModalOpen(false);
                      setSelectedSeat(null);
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="modal-summary">
                  <div className="modal-summary-row">
                    <span style={{ color: "var(--sage)" }}>Seat</span>
                    <strong>{selectedSeat?.seat_number} ({selectedSeat?.seat_type || "Standard"})</strong>
                  </div>
                  <div className="modal-summary-row">
                    <span style={{ color: "var(--sage)" }}>Date</span>
                    <strong>{activeDate.label}</strong>
                  </div>
                  <div className="modal-summary-row">
                    <span style={{ color: "var(--sage)" }}>Time Interval</span>
                    <strong>{activeSlot.label}</strong>
                  </div>
                  <div className="modal-summary-row">
                    <span style={{ color: "var(--sage)" }}>Duration</span>
                    <strong>2 Hours (Max: {usageRule ? Math.floor(usageRule.max_booking_duration_minutes / 60) : 4}h)</strong>
                  </div>
                  <div className="modal-summary-row">
                    <span style={{ color: "var(--sage)" }}>Check-in Window</span>
                    <strong>Within {usageRule?.check_in_window_minutes ?? 20} mins of start</strong>
                  </div>
                </div>

                {bookingError && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px", background: "color-mix(in oklab, #9a2d22 15%, transparent)", border: "1px solid #9a2d22", color: "#9a2d22", fontSize: "13px", marginBottom: "16px" }}>
                    <AlertCircle size={16} flex-shrink={0} />
                    <span>{bookingError}</span>
                  </div>
                )}

                <p style={{ fontSize: "12px", color: "var(--sage)", lineHeight: 1.5 }}>
                  * Please arrive and check in via your dashboard within the check-in window. Unclaimed seats may be automatically released for other students.
                </p>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn--sun"
                    style={{ flex: 1 }}
                    onClick={handleConfirmReservation}
                    disabled={bookingLoading}
                  >
                    {bookingLoading ? (
                      <>
                        <Loader2 size={16} className="auth-spinner" />
                        Booking...
                      </>
                    ) : (
                      "Confirm & Reserve ↗"
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn--paper"
                    onClick={() => setModalOpen(false)}
                    disabled={bookingLoading}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
