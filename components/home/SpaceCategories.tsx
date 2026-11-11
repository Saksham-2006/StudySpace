
"use client";

import { useRef } from "react";
import Link from "next/link";
import { useEditorialAnimations } from "./useEditorialAnimations";

const spaces = [
  {
    title: "Quiet study zones",
    description:
      "Find peaceful spaces designed for deep focus, independent learning and uninterrupted study.",
    meta: "INDIVIDUAL · LOW NOISE",
    image:
      "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=640&q=75",
    alt: "Quiet library with tall bookshelves",
  },
  {
    title: "Group study rooms",
    description:
      "Bring your team together in dedicated rooms for discussions, assignments and collaborative work.",
    meta: "GROUPS · DISCUSSION",
    image:
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=640&q=75",
    alt: "Shared workspace with desks and chairs",
  },
  {
    title: "Library spaces",
    description:
      "Explore library seating with access to books, resources and a focused academic environment.",
    meta: "LIBRARY · ACADEMIC",
    image:
      "https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=640&q=75",
    alt: "Library interior with rows of books",
  },
  {
    title: "Individual desks",
    description:
      "Get your own dedicated seat for assignments, revision and everyday study sessions.",
    meta: "PERSONAL · FOCUSED",
    image:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=640&q=75",
    alt: "Individual desk in a modern workspace",
  },
  {
    title: "Collaborative zones",
    description:
      "Work alongside other students in flexible spaces built for sharing ideas and solving problems.",
    meta: "COLLABORATION · FLEXIBLE",
    image:
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=640&q=75",
    alt: "Open collaborative workspace",
  },
  {
    title: "Computer labs",
    description:
      "Find equipped workstations for coding, research, digital projects and technical coursework.",
    meta: "TECHNOLOGY · WORKSTATIONS",
    image:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=640&q=75",
    alt: "Computer workstation with monitor and keyboard",
  },
];

export default function SpaceCategories() {
  const sectionRef = useRef<HTMLElement>(null);

  useEditorialAnimations(sectionRef, "categories");

  return (
    <section
      id="spaces"
      className="programme"
      ref={sectionRef}
    >
      <div className="wrap">
        <div className="sec-head">
          <h2 className="h2" data-lines>
            Find the space that fits your way of thinking.
          </h2>

          <p className="sec-head__text lead" data-reveal>
            Whether you need complete silence, a place to collaborate
            or a computer to work on your next project, discover a
            space that works for you.
          </p>
        </div>

        <ul className="prog-list">
          {spaces.map((space, index) => (
            <li className="prog" key={space.title}>
              <span className="prog__rule" data-rule />

              <Link className="prog__link" href="/spaces">
                <span className="prog__title">
                  {space.title}
                </span>

                <span className="prog__text">
                  {space.description}
                </span>

                <span className="prog__meta">
                  {space.meta}
                </span>

                <span className="prog__img duo">
                  <img
                    src={space.image}
                    alt={space.alt}
                    width="640"
                    height="480"
                    loading={index < 2 ? "eager" : "lazy"}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
