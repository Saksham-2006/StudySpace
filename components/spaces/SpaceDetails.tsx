import Link from "next/link";
import { ArrowLeft, MapPin, Clock } from "lucide-react";
import SeatMap from "@/components/spaces/SeatMap";
import type { StudySpace, Seat, UsageRule } from "@/lib/types/database";

type SpaceDetailsProps = {
  space: StudySpace;
  seats: Seat[];
  usageRule?: UsageRule;
};

export default function SpaceDetails({ space, seats, usageRule }: SpaceDetailsProps) {
  const availableCount = seats.filter((s) => s.computed_state === "available").length;

  return (
    <main className="space-details-page">
      <section className="space-details-hero">
        {space.image_url && (
          <div className="space-details-hero__image">
            <img src={space.image_url} alt={space.name} />
          </div>
        )}

        <div className="space-details-hero__overlay" />

        <div className="space-details-hero__content wrap">
          <Link href="/spaces" className="space-back-link">
            <ArrowLeft size={17} />
            All spaces
          </Link>

          <p className="tracked">{space.space_type}</p>

          <h1>{space.name}</h1>

          <p className="space-details-location">
            <MapPin size={17} />
            {space.location || "Campus"}
          </p>

          <div className="space-details-availability">
            <span>
              {availableCount > 0
                ? `${availableCount} seats available`
                : "Currently fully occupied"}
            </span>

            <span>Capacity: {space.capacity}</span>

            <span>
              <Clock size={13} style={{ display: "inline", marginRight: "6px" }} />
              {space.opening_time.slice(0, 5)} – {space.closing_time.slice(0, 5)}
            </span>
          </div>
        </div>
      </section>

      <section className="wrap space-details-content">
        <div className="space-details-about">
          <div>
            <p className="tracked">ABOUT THIS SPACE</p>
            <h2 className="h2">A place to get things done.</h2>
          </div>

          <div className="space-details-description">
            <p>{space.description}</p>

            {space.facilities && space.facilities.length > 0 && (
              <>
                <h3>Facilities</h3>
                <div className="space-details-facilities">
                  {space.facilities.map((facility) => (
                    <span key={facility}>{facility}</span>
                  ))}
                </div>
              </>
            )}

            <div style={{ marginTop: "32px", padding: "16px", border: "1px solid color-mix(in oklab, var(--ink) 20%, transparent)", fontSize: "13px" }}>
              <strong style={{ display: "block", marginBottom: "6px" }}>Booking Guidelines:</strong>
              <p style={{ color: "var(--sage)", margin: 0 }}>
                Maximum {usageRule?.max_booking_duration_minutes ? Math.floor(usageRule.max_booking_duration_minutes / 60) : 4} hours per session. Reserve up to {usageRule?.advance_booking_limit_days || 7} days in advance. Cancellations permitted up to {usageRule?.cancellation_limit_minutes || 15} minutes prior to start.
              </p>
            </div>
          </div>
        </div>

        <SeatMap
          spaceId={space.id}
          spaceName={space.name}
          capacity={space.capacity}
          initialSeats={seats}
          usageRule={usageRule}
        />
      </section>
    </main>
  );
}
