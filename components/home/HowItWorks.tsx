
"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const steps = [
  {
    number: "01",
    title: "Discover your space",
    description:
      "Browse available libraries, quiet zones, computer labs and group study rooms.",
    meta: "SEARCH · FILTER · EXPLORE",
    time: "01",
  },
  {
    number: "02",
    title: "Choose your seat",
    description:
      "Check availability, compare facilities and select a seat or room that suits your needs.",
    meta: "AVAILABILITY · SEAT SELECTION",
    time: "02",
  },
  {
    number: "03",
    title: "Confirm your booking",
    description:
      "Reserve your selected space and receive your booking confirmation.",
    meta: "RESERVATION · CONFIRMATION",
    time: "03",
  },
  {
    number: "04",
    title: "Arrive and focus",
    description:
      "Check in, use your reserved space and check out when your study session ends.",
    meta: "CHECK-IN · CHECK-OUT",
    time: "04",
  },
];

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const line = section.querySelector(".schedule__line");
      const dot = section.querySelector(".schedule__dot");

      const timelineSettings = {
        trigger: section,
        start: "top 60%",
        end: "bottom 60%",
        scrub: 0.5,
      };

      if (line) {
        gsap.fromTo(
          line,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: timelineSettings,
          }
        );
      }

      if (dot) {
        gsap.fromTo(
          dot,
          { y: 0, opacity: 1 },
          {
            y: () => section.offsetHeight - 18,
            opacity: 1,
            ease: "none",
            scrollTrigger: {
              ...timelineSettings,
              invalidateOnRefresh: true,
            },
          }
        );
      }

      section.querySelectorAll(".day").forEach((day) => {
        ScrollTrigger.create({
          trigger: day,
          start: "top 60%",
          end: "bottom 60%",
          toggleClass: "is-now",
        });
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="how-it-works"
      className="schedule"
      ref={sectionRef}
    >
      <div className="schedule__line" aria-hidden="true" />
      <div className="schedule__dot" aria-hidden="true" />

      <h2 className="schedule__title h2">
        Four simple steps to a better study session.
      </h2>

      {steps.map((step) => (
        <article className="day" key={step.number}>
          <header className="day__head">
            <span className="day__name tracked">
              STEP
            </span>

            <span className="day__date">
              {step.number}
            </span>

            <span className="day__month">
              {step.meta}
            </span>
          </header>

          <ol className="day__list">
            <li className="slot">
              <span className="slot__time">
                {step.time}
              </span>

              <div>
                <h3 className="slot__title">
                  {step.title}
                </h3>

                <p className="slot__meta">
                  {step.description}
                </p>
              </div>
            </li>
          </ol>
        </article>
      ))}
    </section>
  );
}
