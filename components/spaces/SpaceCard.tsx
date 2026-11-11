import Link from "next/link";
import { MapPin, Users, ArrowUpRight, Wifi, Sparkles } from "lucide-react";
import type { StudySpace } from "@/lib/types/database";

type SpaceCardProps = {
  space: StudySpace;
};

export default function SpaceCard({ space }: SpaceCardProps) {
  const isAvailable = (space.available_seats_count ?? space.capacity) > 0 && space.status === "available";

  return (
    <article className="space-card">
      <div className="space-card__image">
        {space.image_url ? (
          <img src={space.image_url} alt={space.name} loading="lazy" />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "var(--khaki)",
              display: "grid",
              placeItems: "center",
              color: "var(--ink)",
            }}
          >
            <Sparkles size={32} />
          </div>
        )}

        <div className={`space-card__status ${!isAvailable ? "is-full" : ""}`}>
          {isAvailable
            ? `${space.available_seats_count ?? space.capacity} seats left`
            : "Fully occupied"}
        </div>
      </div>

      <div className="space-card__content">
        <p className="tracked">{space.space_type}</p>

        <h3>{space.name}</h3>

        <p className="space-card__location">
          <MapPin size={16} />
          {space.location || "Campus"}
        </p>

        {space.description && (
          <p className="space-card__description">{space.description}</p>
        )}

        {space.facilities && space.facilities.length > 0 && (
          <div className="space-card__facilities">
            {space.facilities.slice(0, 3).map((f) => (
              <span key={f}>
                <Wifi size={13} />
                {f}
              </span>
            ))}
          </div>
        )}

        <div className="space-card__footer">
          <div className="space-card__capacity">
            <Users size={16} />
            <span>
              Capacity: <strong>{space.capacity}</strong>
            </span>
          </div>

          <Link href={`/spaces/${space.id}`} className="space-card__link">
            <span>View Seats</span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}

