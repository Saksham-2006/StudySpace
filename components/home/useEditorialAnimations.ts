
"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

type AnimationType = "about" | "categories";

export function useEditorialAnimations(
  sectionRef: RefObject<HTMLElement | null>,
  type: AnimationType
) {
  useEffect(() => {
    const section = sectionRef.current;

    if (!section) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion) return;

    gsap.registerPlugin(ScrollTrigger, SplitText);

    let active = true;
    let split: SplitText | null = null;

    const ctx = gsap.context(() => {
      // ABOUT: decorative arc rotation
      if (type === "about") {
        const arc = section.querySelector(".about__arc");

        if (arc) {
          gsap.fromTo(
            arc,
            { rotation: -30 },
            {
              rotation: 40,
              ease: "none",
              scrollTrigger: {
                trigger: arc.parentElement,
                start: "top bottom",
                end: "bottom top",
                scrub: true,
              },
            }
          );
        }

        // ABOUT: word-by-word opacity reveal
        const statement = section.querySelector(
          "[data-words]"
        );

        if (statement) {
          document.fonts.ready.then(() => {
            if (!active) return;

            ctx.add(() => {
              split = SplitText.create(statement, {
                type: "words",
                autoSplit: true,
              });

              gsap.fromTo(
                split.words,
                { opacity: 0.16 },
                {
                  opacity: 1,
                  ease: "none",
                  stagger: 0.1,
                  scrollTrigger: {
                    trigger: statement,
                    start: "top 78%",
                    end: "bottom 42%",
                    scrub: true,
                  },
                }
              );
            });
          });
        }
      }

      // SHARED: reveal elements from below
      const revealElements = section.querySelectorAll(
        "[data-reveal]"
      );

      revealElements.forEach((element) => {
        gsap.fromTo(
          element,
          {
            y: 44,
            opacity: 0,
          },
          {
            y: 0,
            opacity: 1,
            duration: 1.1,
            ease: "power3.out",
            clearProps: "transform",
            scrollTrigger: {
              trigger: element,
              start: "top 90%",
              once: true,
            },
          }
        );
      });

      // CATEGORIES: horizontal rules draw from left to right
      const rules = section.querySelectorAll("[data-rule]");

      rules.forEach((rule) => {
        gsap.fromTo(
          rule,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: 1.3,
            ease: "power3.inOut",
            scrollTrigger: {
              trigger: rule,
              start: "top 92%",
              once: true,
            },
          }
        );
      });

      // CATEGORIES: heading lines rise into view
      const heading = section.querySelector("[data-lines]");

      if (heading) {
        document.fonts.ready.then(() => {
          if (!active) return;

          ctx.add(() => {
            split = SplitText.create(heading, {
              type: "lines",
              mask: "lines",
              autoSplit: true,
            });

            gsap.from(split.lines, {
              yPercent: 108,
              duration: 1.15,
              ease: "power4.out",
              stagger: 0.09,
              scrollTrigger: {
                trigger: heading,
                start: "top 88%",
                once: true,
              },
            });
          });
        });
      }
    }, section);

    return () => {
      active = false;
      split?.revert();
      ctx.revert();
    };
  }, [sectionRef, type]);
}
