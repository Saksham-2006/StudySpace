
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";

import Navbar from "@/components/layout/Navbar";
import SeatMap from "@/components/spaces/SeatMap";
import { spaces } from "@/lib/data/spaces";

type PageProps = {
  params: Promise<{ id: string }>;
};

function SpaceLoading() {
  return (
    <>
      <Navbar />
      <main className="space-not-found wrap">
        <p className="tracked">LOADING SPACE</p>
        <h1 className="h2">Finding your place...</h1>
      </main>
    </>
  );
}

async function SpaceContent({ params }: PageProps) {
  const { id } = await params;

  const space = spaces.find(
    (item) => item.id === Number(id)
  );

  if (!space) {
    return (
      <>
        <Navbar />
        <main className="space-not-found wrap">
          <p className="tracked">SPACE NOT FOUND</p>

          <h1 className="h2">
            This space doesn't exist.
          </h1>

          <Link href="/spaces" className="btn btn--sun">
            <ArrowLeft size={17} />
            Back to spaces
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="space-details-page">
        <section className="space-details-hero">
          <div className="space-details-hero__image">
            <img src={space.image} alt={space.name} />
          </div>

          <div className="space-details-hero__overlay" />

          <div className="space-details-hero__content wrap">
            <Link href="/spaces" className="space-back-link">
              <ArrowLeft size={17} />
              All spaces
            </Link>

            <p className="tracked">{space.type}</p>

            <h1>{space.name}</h1>

            <p className="space-details-location">
              <MapPin size={17} />
              {space.location}
            </p>

            <div className="space-details-availability">
              <span>
                {space.available > 0
                  ? `${space.available} seats available`
                  : "Currently fully occupied"}
              </span>

              <span>Capacity: {space.capacity}</span>
            </div>
          </div>
        </section>

        <section className="wrap space-details-content">
          <div className="space-details-about">
            <div>
              <p className="tracked">ABOUT THIS SPACE</p>

              <h2 className="h2">
                A place to get things done.
              </h2>
            </div>

            <div className="space-details-description">
              <p>{space.description}</p>

              <h3>Facilities</h3>

              <div className="space-details-facilities">
                {space.facilities.map((facility) => (
                  <span key={facility}>{facility}</span>
                ))}
              </div>
            </div>
          </div>

          <SeatMap
            capacity={space.capacity}
            available={space.available}
          />
        </section>
      </main>
    </>
  );
}

export default function SpaceDetailsPage({ params }: PageProps) {
  return (
    <Suspense fallback={<SpaceLoading />}>
      <SpaceContent params={params} />
    </Suspense>
  );
}
