"use client";

import { useMemo, useState } from "react";
import { Search, ArrowUpRight, RotateCcw } from "lucide-react";
import SpaceCard from "@/components/spaces/SpaceCard";
import type { StudySpace, Building } from "@/lib/types/database";

type SpacesExplorerProps = {
  initialSpaces: StudySpace[];
  buildings: Building[];
};

const CATEGORIES = [
  "All spaces",
  "Library",
  "Quiet Zone",
  "Group Room",
  "Computer Lab",
  "Individual Desk",
];

export default function SpacesExplorer({ initialSpaces, buildings }: SpacesExplorerProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All spaces");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [availability, setAvailability] = useState("all");

  const filteredSpaces = useMemo(() => {
    return initialSpaces.filter((space) => {
      const q = search.toLowerCase();
      const searchMatch =
        !search ||
        space.name.toLowerCase().includes(q) ||
        (space.location && space.location.toLowerCase().includes(q)) ||
        space.space_type.toLowerCase().includes(q) ||
        (space.description && space.description.toLowerCase().includes(q));

      const categoryMatch =
        category === "All spaces" || space.space_type === category;

      const buildingMatch =
        buildingFilter === "all" ||
        space.building_id === buildingFilter ||
        (space.location && space.location.toLowerCase().includes(buildingFilter.toLowerCase()));

      const availableSeats = space.available_seats_count ?? space.capacity;
      const availabilityMatch =
        availability === "all" ||
        (availability === "available" && availableSeats > 0) ||
        (availability === "full" && availableSeats === 0);

      return searchMatch && categoryMatch && buildingMatch && availabilityMatch;
    });
  }, [initialSpaces, search, category, buildingFilter, availability]);

  const hasActiveFilters =
    search !== "" ||
    category !== "All spaces" ||
    buildingFilter !== "all" ||
    availability !== "all";

  const resetFilters = () => {
    setSearch("");
    setCategory("All spaces");
    setBuildingFilter("all");
    setAvailability("all");
  };

  return (
    <main className="spaces-page">
      <section className="spaces-hero dark">
        <div className="wrap spaces-hero__inner">
          <p className="tracked">CAMPUS STUDY SPACES</p>

          <h1 className="spaces-hero__title">
            Find your place
            <br />
            to <span>focus.</span>
          </h1>

          <p className="lead spaces-hero__description">
            Discover real-time seat availability across libraries, computer labs, and quiet study zones. Reserve your seat and study with clarity.
          </p>

          <a href="#space-discovery" className="btn btn--sun">
            Explore spaces <ArrowUpRight size={17} />
          </a>
        </div>
      </section>

      <section className="wrap spaces-discovery" id="space-discovery">
        <div className="sec-head">
          <div>
            <p className="tracked">EXPLORE THE CAMPUS</p>
            <h2 className="h2">Spaces for every way of studying.</h2>
          </div>
          <p className="lead">
            Filter by building, space type, or real-time seat availability to reserve your next productive session.
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="spaces-controls">
          <label className="spaces-search">
            <Search size={19} />
            <input
              type="search"
              placeholder="Search by space name, building or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <select
              className="spaces-select"
              value={buildingFilter}
              onChange={(e) => setBuildingFilter(e.target.value)}
              aria-label="Filter by building"
            >
              <option value="all">All Buildings</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              className="spaces-select"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              aria-label="Filter by availability"
            >
              <option value="all">All Availability</option>
              <option value="available">Seats Available Now</option>
              <option value="full">Currently Full</option>
            </select>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="spaces-categories" aria-label="Space categories">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              className={`spaces-category ${category === item ? "is-active" : ""}`}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {/* Results Counter & Reset */}
        <div className="spaces-results">
          <p>
            Showing <strong>{filteredSpaces.length}</strong> {filteredSpaces.length === 1 ? "study space" : "study spaces"}
          </p>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
            >
              <RotateCcw size={13} />
              Reset filters
            </button>
          )}
        </div>

        {/* Space Cards Grid */}
        {filteredSpaces.length > 0 ? (
          <div className="spaces-grid">
            {filteredSpaces.map((space) => (
              <SpaceCard key={space.id} space={space} />
            ))}
          </div>
        ) : (
          <div className="spaces-empty">
            <h3>No matching spaces found.</h3>
            <p style={{ color: "var(--sage)" }}>
              We couldn&apos;t find any study spaces matching your selected filters. Try broadening your criteria or search term.
            </p>
            <button type="button" className="btn btn--sun" onClick={resetFilters}>
              Clear All Filters
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

