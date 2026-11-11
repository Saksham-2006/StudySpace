import { Suspense } from "react";
import SpaceManager from "@/components/admin/SpaceManager";
import { getSpaces, getBuildings } from "@/lib/services/spaces";

export const instant = false;

async function SpacesContent() {
  const [spaces, buildings] = await Promise.all([
    getSpaces(),
    getBuildings(),
  ]);

  return <SpaceManager initialSpaces={spaces} buildings={buildings} />;
}

export default function AdminSpacesPage() {
  return (
    <Suspense fallback={<div>Loading spaces...</div>}>
      <SpacesContent />
    </Suspense>
  );
}
