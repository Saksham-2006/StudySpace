
"use client";

import { useMemo, useState } from "react";
import { Check, Armchair } from "lucide-react";

type SeatMapProps = {
  capacity: number;
  available: number;
};

export default function SeatMap({
  capacity,
  available,
}: SeatMapProps) {
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);

  const seats = useMemo(() => {
    const safeCapacity = Math.max(0, Math.floor(capacity));
    const safeAvailable = Math.min(
      safeCapacity,
      Math.max(0, Math.floor(available))
    );

    // Generate a deterministic ranking for each seat.
    // This distributes availability without changing it on rerenders.
    const rankedSeats = Array.from(
      { length: safeCapacity },
      (_, index) => {
        const id = index + 1;

        const hash =
          Math.sin(id * 127.1 + safeCapacity * 311.7) * 43758.5453;

        return {
          id,
          rank: hash - Math.floor(hash),
        };
      }
    );

    const availableIds = new Set(
      rankedSeats
        .sort((a, b) => a.rank - b.rank)
        .slice(0, safeAvailable)
        .map((seat) => seat.id)
    );

    return Array.from({ length: safeCapacity }, (_, index) => ({
      id: index + 1,
      available: availableIds.has(index + 1),
    }));
  }, [capacity, available]);

  const handleContinue = () => {
    if (selectedSeat === null) return;

    alert(
      `Seat S${String(selectedSeat).padStart(2, "0")} selected. Booking will be implemented next.`
    );
  };

  return (
    <section className="seat-selection">
      <div className="seat-selection__heading">
        <div>
          <p className="tracked">CHOOSE YOUR PLACE</p>
          <h2 className="h2">Select your seat.</h2>
        </div>

        <p className="seat-selection__count">
          {available} of {capacity} available
        </p>
      </div>

      <div className="seat-legend">
        <span>
          <i className="legend-available" />
          Available
        </span>

        <span>
          <i className="legend-occupied" />
          Occupied
        </span>

        <span>
          <i className="legend-selected" />
          Selected
        </span>
      </div>

      <div className="seat-map">
        <div className="seat-map__screen">
          FRONT / BOARD
        </div>

        <div className="seat-map__grid">
          {seats.map((seat) => {
            const isSelected = selectedSeat === seat.id;

            return (
              <button
                key={seat.id}
                type="button"
                disabled={!seat.available}
                aria-label={`Seat S${String(seat.id).padStart(2, "0")}, ${
                  isSelected
                    ? "selected"
                    : seat.available
                      ? "available"
                      : "occupied"
                }`}
                aria-pressed={isSelected}
                className={`seat ${
                  !seat.available ? "is-occupied" : ""
                } ${isSelected ? "is-selected" : ""}`}
                onClick={() =>
                  setSelectedSeat(isSelected ? null : seat.id)
                }
              >
                {isSelected ? (
                  <Check size={17} />
                ) : (
                  <Armchair size={17} />
                )}

                <span>
                  S{String(seat.id).padStart(2, "0")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="seat-selection__footer">
        <p>
          {selectedSeat !== null
            ? `You've selected seat S${String(selectedSeat).padStart(2, "0")}.`
            : "Select an available seat to continue."}
        </p>

        <button
          type="button"
          className="btn btn--sun"
          disabled={selectedSeat === null}
          onClick={handleContinue}
        >
          Continue ↗
        </button>
      </div>
    </section>
  );
}
