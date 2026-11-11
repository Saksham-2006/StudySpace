
"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default function Hero() {
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const hero = heroRef.current;

    if (!hero) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reducedMotion) return;

    gsap.registerPlugin(ScrollTrigger);

    const root = document.documentElement;
    root.classList.add("motion");

    const ctx = gsap.context(() => {
      const poster = hero.querySelector(".hero__poster");
      const sun = hero.querySelector(".hero__sun");
      const disc = hero.querySelector(".hero__disc");
      const orbit = hero.querySelector(".hero__orbit");
      const year = hero.querySelector(".hero__year");
      const figure = hero.querySelector(".hero__figure");
      const pillars = hero.querySelectorAll(".hero__pillars .pillar");
      const fade = hero.querySelectorAll(
        ".hero__dates, .hero__intro"
      );

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: hero,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.7,
          invalidateOnRefresh: true,
        },
      });

      timeline.to(hero, { "--sweep": 1, duration: 1, ease: "power1.inOut" }, 0);

      if (sun && poster) {
        timeline.to(
          sun,
          {
            y: () => poster.getBoundingClientRect().height * 0.84,
            duration: 1,
            ease: "power1.in",
          },
          0
        );
      }

      if (year) {
        timeline.to(year, {
          yPercent: -22,
          "--glow": 1,
          duration: 1,
        }, 0);
      }

      if (figure) {
        timeline.to(figure, { yPercent: -7, duration: 1 }, 0);
      }

      if (pillars.length) {
        timeline.to(
          pillars,
          {
            yPercent: (index) => 8 + (index % 3) * 7,
            duration: 1,
            stagger: 0.02,
          },
          0
        );
      }

      if (fade.length) {
        timeline.to(fade, {
          opacity: 0,
          y: -24,
          duration: 0.35,
        }, 0.45);
      }

      const loops: gsap.core.Animation[] = [];

      if (orbit) {
        loops.push(
          gsap.fromTo(
            orbit,
            { rotation: -14 },
            {
              rotation: 22,
              duration: 7,
              ease: "sine.inOut",
              yoyo: true,
              repeat: -1,
              transformOrigin: "50% 50%",
            }
          )
        );
      }

      if (disc) {
        loops.push(
          gsap.to(disc, {
            y: "1.6svh",
            duration: 5.5,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          })
        );
      }

      ScrollTrigger.create({
        trigger: hero,
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) => {
          loops.forEach((animation) =>
            self.isActive ? animation.resume() : animation.pause()
          );
        },
      });
    }, hero);

    return () => {
      ctx.revert();
      root.classList.remove("motion");
    };
  }, []);

  return (
    <section id="hero" className="hero" ref={heroRef}>
      <div className="hero__stage">
        <div className="hero__poster">
          <div className="hero__field" aria-hidden="true" />

          <div className="hero__sun" aria-hidden="true">
            <div className="hero__disc" />
            <svg className="hero__orbit" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="49.5"
                pathLength="100"
                strokeDasharray="30 70"
                strokeDashoffset="-44"
              />
            </svg>
          </div>

          <h1 className="hero__title">
            <span className="wm" style={{ "--len": 9 } as React.CSSProperties}>
              STUDY SPACE
            </span>
          </h1>

          <p className="hero__year" aria-hidden="true">
            <span>20</span>
            <span>26</span>
          </p>

          <div className="hero__pillars" aria-hidden="true">
            <i className="pillar pl-a" />
            <i className="pillar pl-b" />
            <i className="pillar pl-c" />
            <i className="pillar pl-d" />
            <i className="pillar pl-e" />
            <i className="pillar pl-f" />
            <i className="pillar pl-g" />
          </div>

          <figure className="hero__figure duo">
            <img
              src="https://images.unsplash.com/photo-1700748909387-e27f178c7115?auto=format&fit=crop&w=900&q=75"
              alt="Editorial portrait of a seated person"
              width="900"
              height="1125"
              fetchPriority="high"
            />
          </figure>

          <p className="hero__dates tracked">
            YOUR SPACE · YOUR FOCUS · YOUR PACE
          </p>

          <div className="hero__intro">
            <p>
              A better place to study is closer than you think. Discover
              available study spaces, reserve your seat and make every
              study session count.
            </p>

            <div className="hero__actions">
              <a className="btn" href="#spaces">
                Find a study space
              </a>

              <a className="link" href="#how-it-works">
                How it works
              </a>
            </div>
          </div>
        </div>

        <div className="hero__base">
          <p>
            Discover
            <br />
            Find spaces that fit
          </p>

          <p>
            Reserve
            <br />
            Book your place
          </p>

          <p>
            Focus
            <br />
            Make time count
          </p>
        </div>
      </div>
    </section>
  );
}
