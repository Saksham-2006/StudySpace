
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const navLinks = [
  { label: "Home", href: "/#hero" },
  { label: "About", href: "/#about" },
  { label: "Spaces", href: "/#spaces" },
  { label: "How it works", href: "/#venue" },
  { label: "Gallery", href: "/#gallery" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const header = document.querySelector(".site-head");

    if (!header) return;

    let lastScroll = window.scrollY;
    let ticking = false;

    const updateHeader = () => {
      const currentScroll = window.scrollY;

      header.classList.toggle("is-solid", currentScroll > 12);

      if (!root.classList.contains("menu-open")) {
        if (currentScroll > lastScroll + 2 && currentScroll > 320) {
          header.classList.add("is-hidden");
        }

        if (
          currentScroll < lastScroll - 2 ||
          currentScroll < 320
        ) {
          header.classList.remove("is-hidden");
        }
      }

      lastScroll = currentScroll;
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateHeader);
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    updateHeader();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("menu-open", menuOpen);
    document.body.style.overflow = menuOpen ? "hidden" : "";

    return () => {
      document.documentElement.classList.remove("menu-open");
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-head">
      {/* Brand */}
      <Link
        className="brand"
        href="#hero"
        onClick={closeMenu}
        aria-label="Seat to Study, home"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="11" cy="10" r="8" fill="var(--sun)" />
          <path
            d="M3.6 16.5A9 9 0 0 1 6 3.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
        Seat to Study
      </Link>

      {/* Navigation */}
      <nav className="nav" id="site-nav" aria-label="Main navigation">
        {navLinks.map((link) => (
          <a key={link.href} href={link.href} onClick={closeMenu}>
            {link.label}
          </a>
        ))}

        <Link className="nav__login" href="/login" onClick={closeMenu}>
          Sign In
        </Link>

        <Link className="btn" href="/spaces" onClick={closeMenu}>
          Find a Seat
        </Link>
      </nav>

      {/* Mobile menu */}
      <button
        className="menu-btn"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="site-nav"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
      </button>
    </header>
  );
}
