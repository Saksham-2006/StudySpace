
"use client";

import { useRef } from "react";
import { useEditorialAnimations } from "./useEditorialAnimations";

export default function About() {
  const sectionRef = useRef<HTMLElement>(null);

  useEditorialAnimations(sectionRef, "about");

  return (
    <section
      id="about"
      className="about dark"
      ref={sectionRef}
    >
      <svg
        className="about__arc"
        viewBox="0 0 100 100"
        aria-hidden="true"
        data-drift
      >
        <circle
          cx="50"
          cy="50"
          r="49.5"
          pathLength="100"
          strokeDasharray="34 66"
          strokeDashoffset="-8"
        />
      </svg>

      <div className="wrap">
        <p className="about__statement" data-words>
          A good study session starts with the right environment.
          Seat to Study brings students and study spaces together —
          making it easier to find your focus, reserve your place
          and spend less time searching for somewhere to sit.
        </p>

        <ul className="facts">
          <li className="fact" data-reveal>
            <span className="fact__num" style={{ "--len": 1 } as React.CSSProperties}>
              01
            </span>
            <span className="fact__text">
              Discover spaces that match your needs
            </span>
          </li>

          <li className="fact" data-reveal>
            <span className="fact__num" style={{ "--len": 2 } as React.CSSProperties}>
              02
            </span>
            <span className="fact__text">
              Reserve seats and rooms with ease
            </span>
          </li>

          <li className="fact" data-reveal>
            <span className="fact__num" style={{ "--len": 1 } as React.CSSProperties}>
              03
            </span>
            <span className="fact__text">
              Make every study session count
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}
