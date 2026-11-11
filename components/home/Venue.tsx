
"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function Venue() {
    const sectionRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const section = sectionRef.current;
        if (!section) return;

        const stage = section.querySelector(".venue__stage");
        const photo = section.querySelector<HTMLElement>(".venue__photo");

        if (!stage || !photo) return;

        const image = photo.querySelector("img");
        const tint = section.querySelector(".venue__tint");
        const shade = section.querySelector(".venue__shade");
        const moon = section.querySelector(".venue__moon");
        const ring = section.querySelector(".venue__ring");
        const title = section.querySelector(".venue__title");
        const info = section.querySelector(".venue__info");

        const ctx = gsap.context(() => {
            const initialRadius = () =>
                `${window.innerWidth < 761 ? 31 : 20}vmin`;

            const timeline = gsap.timeline({
                defaults: { ease: "none" },
                scrollTrigger: {
                    trigger: section,
                    start: "top top",
                    end: "bottom bottom",
                    scrub: 0.7,
                    invalidateOnRefresh: true,
                },
            });

            timeline.fromTo(
                photo,
                {
                    clipPath: () => `circle(${initialRadius()} at 50% 52%)`,
                },
                {
                    clipPath: "circle(75% at 50% 52%)",
                    duration: 0.62,
                    ease: "power2.inOut",
                },
                0.16
            );

            if (image) {
                timeline.fromTo(
                    image,
                    { scale: 1.4 },
                    { scale: 1, duration: 0.8 },
                    0
                );
            }

            if (tint) {
                timeline.fromTo(
                    tint,
                    { opacity: 1 },
                    { opacity: 0, duration: 0.4, ease: "power1.inOut" },
                    0.3
                );
            }

            if (moon) {
                timeline.fromTo(
                    moon,
                    { xPercent: 42, opacity: 1 },
                    { xPercent: 170, opacity: 0, duration: 0.34, ease: "power1.in" },
                    0
                );
            }

            if (ring) {
                timeline.fromTo(
                    ring,
                    { scale: 1, opacity: 1, rotation: -40 },
                    { scale: 3.4, opacity: 0, rotation: 20, duration: 0.55 },
                    0.08
                );
            }

            if (shade) {
                timeline.fromTo(
                    shade,
                    { opacity: 0 },
                    { opacity: 1, duration: 0.35 },
                    0.42
                );
            }

            if (title) {
                timeline.fromTo(
                    title,
                    { y: 0 },
                    { y: -30, duration: 1 },
                    0
                );
            }

            if (info) {
                timeline.fromTo(
                    info,
                    { y: 50, opacity: 0 },
                    { y: 0, opacity: 1, duration: 0.25 },
                    0.7
                );
            }
        }, section);

        return () => ctx.revert();
    }, []);

    return (
        <section
            ref={sectionRef}
            id="venue"
            className="venue"
            data-kind="venue"
        >
            <div className="venue__stage">

                <figure className="venue__photo">
                    <div className="venue__tint" aria-hidden="true" />

                    <img
                        src="https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1920&q=90"
                        alt="A spacious library environment with books and inviting study areas"
                        loading="lazy"
                    />
                </figure>

                <div className="venue__shade" aria-hidden="true" />
                <div className="venue__moon" aria-hidden="true" />

                <svg
                    className="venue__ring"
                    viewBox="0 0 100 100"
                    aria-hidden="true"
                >
                    <circle
                        cx="50"
                        cy="50"
                        r="49.5"
                        pathLength="100"
                        strokeDasharray="62 38"
                        strokeDashoffset="12"
                    />
                </svg>

                <h2 className="venue__title h2">
                    A space that makes room for better thinking.
                </h2>

                <div className="venue__info">
                    <p className="lead">
                        The right environment can change the way you learn.
                        Discover thoughtfully designed study spaces where
                        quiet focus, collaboration and comfort come together.
                    </p>

                    <dl className="venue__facts">
                        <div>
                            <dt>Discover</dt>
                            <dd>Libraries, quiet zones and collaborative spaces</dd>
                        </div>

                        <div>
                            <dt>Check</dt>
                            <dd>Real-time seat and room availability</dd>
                        </div>

                        <div>
                            <dt>Reserve</dt>
                            <dd>Book your preferred space before you arrive</dd>
                        </div>
                    </dl>

                    <div className="venue__actions">
                        <a className="btn btn--sun" href="/spaces">
                            Find your study space
                        </a>
                    </div>
                </div>

            </div>
        </section>
    );
}
