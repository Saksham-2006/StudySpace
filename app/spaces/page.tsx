import { Suspense } from "react";
import Navbar from "@/components/layout/Navbar";
import SpacesExplorer from "@/components/spaces/SpacesExplorer";
import { getSpaces, getBuildings } from "@/lib/services/spaces";

export const instant = false;

async function SpacesContent() {
  const [spaces, buildings] = await Promise.all([
    getSpaces(),
    getBuildings(),
  ]);

  return <SpacesExplorer initialSpaces={spaces} buildings={buildings} />;
}

export default function SpacesPage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<div className="wrap" style={{ padding: "120px 0" }}>Loading spaces...</div>}>
        <SpacesContent />
      </Suspense>
    </>
  );
}
