"use client";

import { useState } from "react";
import { Power, CheckCircle2, Armchair, X, AlertCircle, Loader2 } from "lucide-react";
import type { StudySpace, Building as BuildingType, Seat } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/client";

type SpaceManagerProps = {
  initialSpaces: StudySpace[];
  buildings: BuildingType[];
};

export default function SpaceManager({ initialSpaces, buildings }: SpaceManagerProps) {
  const [spaces, setSpaces] = useState<StudySpace[]>(initialSpaces);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Seat management modal state
  const [selectedSpace, setSelectedSpace] = useState<StudySpace | null>(null);
  const [spaceSeats, setSpaceSeats] = useState<Seat[]>([]);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [togglingSeatId, setTogglingSeatId] = useState<string | null>(null);

  const handleToggleStatus = async (space: StudySpace) => {
    setUpdatingId(space.id);
    setMessage(null);

    const nextStatus = space.status === "available" ? "maintenance" : "available";

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("spaces")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", space.id);

      if (error) {
        throw error;
      }

      setSpaces((prev) =>
        prev.map((s) => (s.id === space.id ? { ...s, status: nextStatus } : s))
      );

      setMessage({
        text: `Space '${space.name}' status set to ${nextStatus}.`,
        type: "success",
      });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Failed to update space status.",
        type: "error",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleInspectSeats = async (space: StudySpace) => {
    setSelectedSpace(space);
    setLoadingSeats(true);
    setSpaceSeats([]);

    const now = new Date();
    const startAt = now.toISOString();
    const endAt = new Date(now.getTime() + 2 * 3600 * 1000).toISOString();

    try {
      const res = await fetch(
        `/api/spaces/${space.id}/availability?startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`
      );
      const data = await res.json();
      if (res.ok && data.seats) {
        setSpaceSeats(data.seats);
      } else {
        setSpaceSeats([]);
      }
    } catch {
      setSpaceSeats([]);
    } finally {
      setLoadingSeats(false);
    }
  };

  const handleToggleSeatStatus = async (seat: Seat) => {
    setTogglingSeatId(seat.id);
    const nextStatus = seat.status === "available" ? "maintenance" : "available";

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("seats")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", seat.id);

      if (error) throw error;

      setSpaceSeats((prev) =>
        prev.map((s) =>
          s.id === seat.id
            ? { ...s, status: nextStatus, computed_state: nextStatus === "maintenance" ? "unavailable" : "available" }
            : s
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update seat status.");
    } finally {
      setTogglingSeatId(null);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <p className="tracked" style={{ color: "var(--rust)" }}>CAMPUS INVENTORY</p>
          <h1 className="h2" style={{ fontSize: "clamp(36px, 5vw, 64px)" }}>
            Study Spaces & Desks
          </h1>
        </div>

        <div>
          <span style={{ fontSize: "14px", color: "var(--sage)" }}>
            <strong>{spaces.length}</strong> spaces registered
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
          <CheckCircle2 size={18} />
          <span>{message.text}</span>
        </div>
      )}

      {/* Buildings Summary Bar */}
      <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "16px", marginBottom: "32px" }}>
        {buildings.map((b) => (
          <div
            key={b.id}
            style={{
              padding: "12px 18px",
              border: "1px solid color-mix(in oklab, var(--ink) 20%, transparent)",
              background: "color-mix(in oklab, var(--paper) 95%, white)",
              whiteSpace: "nowrap",
              fontSize: "13px",
            }}
          >
            <strong>{b.name}</strong>
            <div style={{ color: "var(--sage)", fontSize: "11px", marginTop: "2px" }}>{b.location || "Main Campus"}</div>
          </div>
        ))}
      </div>

      {/* Spaces Table */}
      <div className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Space Name</th>
                <th>Type</th>
                <th>Location & Zone</th>
                <th>Capacity</th>
                <th>Hours</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {spaces.map((space) => {
                const isUpdating = updatingId === space.id;
                const zoneText = space.zone ? `${space.zone.name} (Fl. ${space.zone.floor_number})` : (space.location || "Campus");

                return (
                  <tr key={space.id}>
                    <td>
                      <strong>{space.name}</strong>
                      <div style={{ fontSize: "12px", color: "var(--sage)" }}>
                        {space.facilities?.join(" · ")}
                      </div>
                    </td>
                    <td>{space.space_type}</td>
                    <td style={{ fontSize: "13px" }}>{zoneText}</td>
                    <td>
                      <strong>{space.capacity}</strong> seats
                    </td>
                    <td style={{ fontSize: "13px" }}>
                      {space.opening_time.slice(0, 5)} – {space.closing_time.slice(0, 5)}
                    </td>
                    <td>
                      <span
                        className={`status-badge ${
                          space.status === "available"
                            ? "status-badge--checked_in"
                            : "status-badge--cancelled"
                        }`}
                      >
                        {space.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          className="btn btn--paper"
                          style={{ padding: "6px 12px", fontSize: "12px" }}
                          onClick={() => handleInspectSeats(space)}
                        >
                          <Armchair size={13} />
                          Inspect Seats
                        </button>
                        <button
                          type="button"
                          className="btn btn--paper"
                          style={{ padding: "6px 12px", fontSize: "12px" }}
                          disabled={isUpdating}
                          onClick={() => handleToggleStatus(space)}
                        >
                          <Power size={13} />
                          {space.status === "available" ? "Set Maintenance" : "Set Available"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seat Inspection & Management Modal */}
      {selectedSpace && (
        <div className="modal-backdrop" onClick={() => setSelectedSpace(null)}>
          <div className="modal-card" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <p className="tracked">SEAT INVENTORY MANAGEMENT</p>
                <h3>{selectedSpace.name}</h3>
                <p style={{ color: "var(--sage)", fontSize: "13px", marginTop: "4px" }}>
                  Capacity: <strong>{selectedSpace.capacity}</strong> desks · Mapped Seats: <strong>{spaceSeats.length}</strong>
                </p>
              </div>
              <button
                type="button"
                className="ibtn"
                style={{ width: "36px", height: "36px" }}
                onClick={() => setSelectedSpace(null)}
              >
                <X size={18} />
              </button>
            </div>

            {loadingSeats ? (
              <div style={{ padding: "40px", textAlign: "center" }}>
                <Loader2 size={32} className="auth-spinner" style={{ color: "var(--sun)", margin: "0 auto 12px" }} />
                <p style={{ color: "var(--sage)", fontSize: "14px" }}>Loading seat inventory...</p>
              </div>
            ) : spaceSeats.length === 0 ? (
              <div style={{ padding: "30px", textAlign: "center", border: "1px dashed color-mix(in oklab, var(--ink) 25%, transparent)" }}>
                <AlertCircle size={32} style={{ color: "var(--khaki)", margin: "0 auto 8px" }} />
                <p style={{ color: "var(--sage)", fontSize: "14px" }}>No seats have been mapped to this space yet.</p>
              </div>
            ) : (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px", maxHeight: "380px", overflowY: "auto", padding: "4px" }}>
                  {spaceSeats.map((seat) => {
                    const isToggling = togglingSeatId === seat.id;
                    const isMaint = seat.status === "maintenance";

                    return (
                      <div
                        key={seat.id}
                        style={{
                          border: `1px solid ${isMaint ? "var(--rust)" : "color-mix(in oklab, var(--ink) 20%, transparent)"}`,
                          background: isMaint ? "color-mix(in oklab, var(--rust) 10%, var(--paper))" : "white",
                          padding: "10px",
                          borderRadius: "4px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <strong style={{ fontSize: "14px" }}>{seat.seat_number}</strong>
                          <span style={{ fontSize: "10px", textTransform: "uppercase", padding: "2px 5px", background: "var(--paper)", borderRadius: "2px" }}>
                            {seat.seat_type}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: isMaint ? "var(--rust)" : "var(--sage)" }}>
                          Status: <strong>{seat.status}</strong>
                        </div>
                        <button
                          type="button"
                          className="btn btn--paper"
                          style={{ padding: "4px 8px", fontSize: "11px", marginTop: "4px" }}
                          disabled={isToggling}
                          onClick={() => handleToggleSeatStatus(seat)}
                        >
                          {isToggling ? "Updating..." : isMaint ? "Set Available" : "Block/Maint"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn--paper"
                onClick={() => setSelectedSpace(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
