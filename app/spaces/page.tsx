
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import { Search, MapPin, Users, Wifi, Plug, VolumeX, ArrowUpRight } from "lucide-react";

type Space = {
    id: number;
    name: string;
    type: string;
    location: string;
    description: string;
    capacity: number;
    available: number;
    image: string;
    facilities: string[];
};

const spaces: Space[] = [
    {
        id: 1,
        name: "Central Library",
        type: "Library",
        location: "Academic Block · Ground Floor",
        description: "A spacious academic environment for focused individual study.",
        capacity: 40,
        available: 18,
        image: "https://images.unsplash.com/photo-1507842217343-583bb7270b66",
        facilities: ["Wi-Fi", "Charging", "Silent zone"],
    },
    {
        id: 2,
        name: "The Quiet Room",
        type: "Quiet Zone",
        location: "Library · Second Floor",
        description: "A peaceful environment for uninterrupted concentration.",
        capacity: 20,
        available: 7,
        image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72",
        facilities: ["Wi-Fi", "Silent zone"],
    },
    {
        id: 3,
        name: "Collaboration Hub",
        type: "Group Room",
        location: "Innovation Block · First Floor",
        description: "A collaborative space for group discussions and projects.",
        capacity: 8,
        available: 3,
        image: "https://images.unsplash.com/photo-1497366811353-6870744d04b2",
        facilities: ["Wi-Fi", "Display", "Whiteboard"],
    },
    {
        id: 4,
        name: "Digital Workspace",
        type: "Computer Lab",
        location: "Technology Block · Third Floor",
        description: "A dedicated workspace equipped for digital learning.",
        capacity: 30,
        available: 0,
        image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085",
        facilities: ["Computers", "Wi-Fi", "Charging"],
    },
    {
        id: 5,
        name: "Open Study Lounge",
        type: "Individual Desk",
        location: "Student Centre · First Floor",
        description: "A comfortable space for independent study and reading.",
        capacity: 24,
        available: 12,
        image: "https://images.unsplash.com/photo-1497366216548-37526070297c",
        facilities: ["Wi-Fi", "Charging"],
    },
    {
        id: 6,
        name: "Research Room",
        type: "Group Room",
        location: "Academic Block · Second Floor",
        description: "A smaller room suited to focused team research sessions.",
        capacity: 6,
        available: 2,
        image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72",
        facilities: ["Wi-Fi", "Whiteboard"],
    },
];

const categories = [
    "All spaces",
    "Library",
    "Quiet Zone",
    "Group Room",
    "Computer Lab",
    "Individual Desk",
];

export default function SpacesPage() {
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("All spaces");
    const [availability, setAvailability] = useState("all");

    const filteredSpaces = useMemo(() => {
        return spaces.filter((space) => {
            const searchMatch =
                space.name.toLowerCase().includes(search.toLowerCase()) ||
                space.location.toLowerCase().includes(search.toLowerCase()) ||
                space.type.toLowerCase().includes(search.toLowerCase());

            const categoryMatch =
                category === "All spaces" || space.type === category;

            const availabilityMatch =
                availability === "all" ||
                (availability === "available" && space.available > 0) ||
                (availability === "full" && space.available === 0);

            return searchMatch && categoryMatch && availabilityMatch;
        });
    }, [search, category, availability]);

    const resetFilters = () => {
        setSearch("");
        setCategory("All spaces");
        setAvailability("all");
    };

    return (
        <>
            <Navbar />

            <main className="spaces-page">
                <section className="spaces-hero dark">
                    <div className="wrap spaces-hero__inner">
                        <p className="tracked">YOUR SPACE. YOUR FOCUS.</p>

                        <h1 className="spaces-hero__title">
                            Find your place
                            <br />
                            to <span>focus.</span>
                        </h1>

                        <p className="lead spaces-hero__description">
                            Discover study spaces across campus, explore their facilities,
                            and find a place that works for you.
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
                            Find a quiet corner, a group room, or your next favourite
                            workspace.
                        </p>
                    </div>

                    <div className="spaces-controls">
                        <label className="spaces-search">
                            <Search size={19} />
                            <input
                                type="search"
                                placeholder="Search by space or location..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </label>

                        <select
                            className="spaces-select"
                            value={availability}
                            onChange={(e) => setAvailability(e.target.value)}
                            aria-label="Filter by availability"
                        >
                            <option value="all">All availability</option>
                            <option value="available">Seats available</option>
                            <option value="full">Fully occupied</option>
                        </select>
                    </div>

                    <div className="spaces-categories" aria-label="Space categories">
                        {categories.map((item) => (
                            <button
                                key={item}
                                type="button"
                                className={`spaces-category ${category === item ? "is-active" : ""
                                    }`}
                                onClick={() => setCategory(item)}
                            >
                                {item}
                            </button>
                        ))}
                    </div>

                    <div className="spaces-results">
                        <p>
                            Showing <strong>{filteredSpaces.length}</strong> spaces
                        </p>

                        {(search || category !== "All spaces" || availability !== "all") && (
                            <button type="button" onClick={resetFilters}>
                                Clear filters
                            </button>
                        )}
                    </div>

                    {filteredSpaces.length > 0 ? (
                        <div className="spaces-grid">
                            {filteredSpaces.map((space) => (
                                <article className="space-card" key={space.id}>
                                    <div className="space-card__image">
                                        <img src={space.image} alt={space.name} />

                                        <span
                                            className={`space-card__status ${space.available > 0 ? "is-available" : "is-full"
                                                }`}
                                        >
                                            {space.available > 0 ? "Available" : "Fully occupied"}
                                        </span>
                                    </div>

                                    <div className="space-card__content">
                                        <p className="tracked">{space.type}</p>

                                        <h3>{space.name}</h3>

                                        <p className="space-card__location">
                                            <MapPin size={15} />
                                            {space.location}
                                        </p>

                                        <p className="space-card__description">
                                            {space.description}
                                        </p>

                                        <div className="space-card__facilities">
                                            {space.facilities.map((facility) => (
                                                <span key={facility}>
                                                    {facility === "Wi-Fi" ? (
                                                        <Wifi size={13} />
                                                    ) : facility === "Charging" ? (
                                                        <Plug size={13} />
                                                    ) : facility === "Silent zone" ? (
                                                        <VolumeX size={13} />
                                                    ) : null}
                                                    {facility}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="space-card__footer">
                                            <div className="space-card__capacity">
                                                <Users size={17} />
                                                <span>
                                                    <strong>{space.available}</strong> / {space.capacity}{" "}
                                                    seats available
                                                </span>
                                            </div>

                                            <Link
                                                href={`/spaces/${space.id}`}
                                                className="space-card__link"
                                                aria-label={`Explore ${space.name}`}
                                            >
                                                Explore <ArrowUpRight size={16} />
                                            </Link>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="spaces-empty">
                            <h3>No spaces found.</h3>
                            <p>Try changing your search or filters.</p>
                            <button className="btn btn--sun" onClick={resetFilters}>
                                Reset filters
                            </button>
                        </div>
                    )}
                </section>
            </main>
        </>
    );
}
