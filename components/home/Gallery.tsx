
"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);


const photos = [
  {
    id: "a",
    speed: "-.5",
    src: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1200&q=85",
    alt: "A welcoming library interior with bookshelves and study areas",
    caption: "A little quiet goes a long way",
  },
  {
    id: "b",
    speed: ".6",
    src: "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=800&q=85",
    alt: "Notebook and writing materials on a desk",
    caption: "Ideas begin on a blank page",
  },
  {
    id: "c",
    speed: "-.2",
    src: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=600&q=85",
    alt: "Students spending time together on campus",
    caption: "Better together, one session at a time",
  },
  {
    id: "d",
    speed: ".3",
    src: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1400&q=85",
    alt: "A beautiful library with rows of bookshelves",
    caption: "Room to think, space to grow",
  },
  {
    id: "e",
    speed: "-.7",
    src: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=85",
    alt: "A thoughtfully designed shared workspace",
    caption: "Spaces that make ideas happen",
  },
  {
    id: "f",
    speed: ".8",
    src: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=600&q=85",
    alt: "People working together with laptops",
    caption: "Every session moves you forward",
  },
];


export default function Gallery() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const isMobile = () => window.innerWidth < 761;

      gsap.utils.toArray<HTMLElement>(".shot").forEach((item) => {
        const speed = Number(item.dataset.speed) || 0;

        const amplitude = () => (isMobile() ? 36 : 90) * speed;

        gsap.fromTo(
          item,
          { y: () => amplitude() },
          {
            y: () => -amplitude(),
            ease: "none",
            scrollTrigger: {
              trigger: ".collage",
              start: "top bottom",
              end: "bottom top",
              scrub: true,
              invalidateOnRefresh: true,
            },
          }
        );
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="gallery"
      className="gallery"
      data-kind="gallery"
    >
      <div className="wrap">
        <h2 className="h2 gallery__title" data-lines>
          Last June, in pictures
        </h2>

        <div className="collage" data-fixed="6">
          {photos.map((photo) => (
            <figure
              key={photo.id}
              className={`shot shot--${photo.id}`}
              data-speed={photo.speed}
            >
              <div className="shot__img">
                <img
                  src={photo.src}
                  alt={photo.alt}
                  loading="lazy"
                />
              </div>
              <figcaption>{photo.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
