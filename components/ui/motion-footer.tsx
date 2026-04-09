"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DELPHI_PROXY, LINKS } from "@/lib/constants";
import {
  LiquidGlassButton,
  LiquidGlassDock,
  LiquidGlassFilter,
  LiquidGlassSurface,
} from "@/components/ui/liquid-glass";
import { SpiralAnimation } from "@/components/ui/spiral-animation";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

function FooterMarkIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        d="M4 12h4l2-4 4 8 2-4h4"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FooterWalletIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5V9h-3a2 2 0 0 0 0 4h3v1.5A2.5 2.5 0 0 1 16.5 17h-11A2.5 2.5 0 0 1 3 14.5v-7Z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 9h1.5A1.5 1.5 0 0 1 22 10.5v1a1.5 1.5 0 0 1-1.5 1.5H19"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FooterArchiveIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        d="M5 8.5h14M7 5h10a1 1 0 0 1 1 1v3H6V6a1 1 0 0 1 1-1Zm-1 4h12v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9Zm4 3h4"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FooterChainIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        d="m10 14-2 2a3 3 0 1 0 4.243 4.243l2-2M14 10l2-2A3 3 0 0 0 11.757 3.757l-2 2M9 15l6-6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const marqueeItems = [
  "Delphi Analytics",
  "Gensyn Testnet",
  "Live market sync",
  "Wallet P&L tracking",
  "Market archive",
  "Explorer transparency",
];

export function CinematicFooter() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const giantTextRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subheadingRef = useRef<HTMLParagraphElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const badgesRef = useRef<HTMLDivElement>(null);
  const bottomBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapperRef.current) {
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        giantTextRef.current,
        { y: "10vh", scale: 0.88, opacity: 0 },
        {
          y: "0vh",
          scale: 1,
          opacity: 1,
          ease: "power1.out",
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: "top 85%",
            end: "bottom bottom",
            scrub: 1,
          },
        }
      );

      gsap.fromTo(
        [
          headingRef.current,
          subheadingRef.current,
          dockRef.current,
          actionsRef.current,
          badgesRef.current,
          bottomBarRef.current,
        ],
        { y: 56, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.12,
          ease: "power3.out",
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: "top 72%",
            end: "bottom 85%",
            scrub: 0.9,
          },
        }
      );
    }, wrapperRef);

    return () => ctx.revert();
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const dockItems = [
    {
      label: "Markets",
      href: "/markets",
      icon: <FooterMarkIcon />,
    },
    {
      label: "Leaderboard",
      href: "/leaderboard",
      icon: <FooterWalletIcon />,
    },
    {
      label: "Delphi",
      href: LINKS.delphi,
      external: true,
      icon: <FooterArchiveIcon />,
    },
    {
      label: "Explorer",
      href: LINKS.explorer,
      external: true,
      icon: <FooterChainIcon />,
    },
  ];

  return (
    <div
      ref={wrapperRef}
      className="relative h-[88vh] w-full"
      style={{ clipPath: "polygon(0% 0, 100% 0%, 100% 100%, 0 100%)" }}
    >
      <LiquidGlassFilter />

      <footer className="motion-footer-shell fixed bottom-0 left-0 flex h-[88vh] w-full flex-col justify-between overflow-hidden bg-[var(--bg-primary)] text-white">
        <div className="motion-footer-aurora pointer-events-none absolute left-1/2 top-1/2 h-[46vh] w-[72vw] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[70px]" />
        <div className="motion-footer-grid pointer-events-none absolute inset-0" />
        <div className="motion-footer-vignette pointer-events-none absolute inset-0" />

        <div className="motion-footer-spiral pointer-events-none absolute inset-0 opacity-70">
          <SpiralAnimation
            particleColor="rgba(191,145,255,0.95)"
            trailLength={58}
            starCount={1700}
          />
        </div>

        <div
          ref={giantTextRef}
          className="motion-footer-giant pointer-events-none absolute inset-x-0 bottom-[-6vh] text-center select-none"
        >
          DELPHI
        </div>

        <div className="absolute top-14 left-1/2 z-10 w-[112%] -translate-x-1/2 -rotate-[1.6deg] overflow-hidden border-y border-white/10 bg-black/30 py-3 backdrop-blur-md">
          <div className="motion-footer-marquee-track flex w-max text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
            {[...Array(2)].map((_, group) => (
              <div key={group} className="flex items-center">
                {marqueeItems.map((item, index) => (
                  <div key={`${group}-${item}`} className="flex items-center space-x-4 px-5">
                    <span>{item}</span>
                    <span className={index % 2 === 0 ? "text-cyan-300/55" : "text-amber-200/45"}>✦</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-1 flex-col justify-center px-6 pt-20 md:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <p className="page-eyebrow mx-auto">Motion Footer</p>
            <h2
              ref={headingRef}
              className="mt-8 text-4xl font-black tracking-[-0.05em] text-white sm:text-6xl md:text-7xl"
            >
              Stay ready for the next Delphi market.
            </h2>
            <p
              ref={subheadingRef}
              className="mx-auto mt-6 max-w-3xl text-sm leading-8 text-zinc-300 sm:text-base"
            >
              A premium footer designed as a final command surface: launch Delphi, move into the
              market archive, trace the contract, or jump into the explorer while the homepage
              stays synced for the next official release.
            </p>
          </div>

          <div ref={dockRef} className="mt-10 flex justify-center">
            <LiquidGlassDock items={dockItems} className="rounded-[1.9rem] px-4 py-3" />
          </div>

          <div ref={actionsRef} className="mt-8 flex flex-wrap justify-center gap-3">
            <LiquidGlassButton href={LINKS.delphi} external variant="primary">
              Open Official Delphi
            </LiquidGlassButton>
            <LiquidGlassButton href="/markets" variant="secondary">
              Browse Market Archive
            </LiquidGlassButton>
            <LiquidGlassButton href="/leaderboard" variant="ghost">
              Open Leaderboard
            </LiquidGlassButton>
          </div>

          <div ref={badgesRef} className="mt-7 flex flex-wrap justify-center gap-3">
            <LiquidGlassSurface className="rounded-full px-4 py-2.5 text-sm text-zinc-200">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.65)]" />
                Tracking {DELPHI_PROXY.slice(0, 10)}...{DELPHI_PROXY.slice(-6)}
              </div>
            </LiquidGlassSurface>
            <LiquidGlassSurface className="rounded-full px-4 py-2.5 text-sm text-zinc-200">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.65)]" />
                Automatic live-market handoff enabled
              </div>
            </LiquidGlassSurface>
          </div>
        </div>

        <div
          ref={bottomBarRef}
          className="relative z-20 mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-5 px-6 pb-7 pt-5 md:flex-row md:px-8"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            © 2026 Delphi Analytics · Gensyn Testnet
          </div>

          <LiquidGlassSurface className="rounded-full px-5 py-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-300">
              <span>Built by</span>
              <span className="text-white">xailong_6969</span>
            </div>
          </LiquidGlassSurface>

          <button
            type="button"
            onClick={scrollToTop}
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-200 backdrop-blur-md transition-all hover:-translate-y-1 hover:border-white/20 hover:bg-white/10"
          >
            Back to top
            <svg
              className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="m5 10 7-7m0 0 7 7m-7-7v18"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </footer>
    </div>
  );
}
