import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import Navbar from "@/components/layout/Navbar";
import SpaceDetails from "@/components/spaces/SpaceDetails";
import { getSpaceById, getSpaceSeats, getSpaceUsageRules } from "@/lib/services/spaces";

export const instant = false;

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

  const space = await getSpaceById(id);

  if (!space) {
    return (
      <>
        <Navbar />
        <main className="space-not-found wrap">
          <p className="tracked">SPACE NOT FOUND</p>

          <h1 className="h2">This space doesn&apos;t exist.</h1>

          <Link href="/spaces" className="btn btn--sun">
            <ArrowLeft size={17} />
            Back to spaces
          </Link>
        </main>
      </>
    );
  }

  const [seats, usageRule] = await Promise.all([
    getSpaceSeats(space.id),
    getSpaceUsageRules(space.id),
  ]);

  return (
    <>
      <Navbar />
      <SpaceDetails space={space} seats={seats} usageRule={usageRule} />
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
