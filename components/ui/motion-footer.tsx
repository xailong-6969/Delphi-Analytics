"use client";

import { DELPHI_PROXY, LINKS } from "@/lib/constants";
import {
  LiquidGlassButton,
  LiquidGlassDock,
  LiquidGlassSurface,
} from "@/components/ui/liquid-glass";

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
    <footer className="motion-footer-shell relative mt-14 overflow-hidden border-t border-white/6">
      <div className="motion-footer-grid pointer-events-none absolute inset-0" />
      <div className="motion-footer-vignette pointer-events-none absolute inset-0" />
      <div className="motion-footer-giant pointer-events-none absolute inset-x-0 bottom-[-1.5rem] text-center select-none">
        DELPHI
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-16 md:px-8">
        <div className="motion-footer-marquee rounded-full border border-white/8 bg-white/[0.03] px-4 py-3">
          <div className="motion-footer-marquee-track flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            {marqueeItems.map((item, index) => (
              <div key={item} className="flex items-center gap-4">
                <span>{item}</span>
                {index < marqueeItems.length - 1 ? (
                  <span className={index % 2 === 0 ? "text-cyan-300/50" : "text-amber-200/40"}>•</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-6">
            <div>
              <p className="page-eyebrow">Footer Command Deck</p>
              <h2 className="mt-6 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">
                Stay ready for the next Delphi market.
              </h2>
              <p className="mt-5 max-w-3xl text-sm leading-8 text-zinc-300 sm:text-base">
                A lighter closing section that keeps the important links close: official Delphi,
                the market archive, leaderboard, explorer, and the tracked contract.
              </p>
            </div>

            <LiquidGlassDock items={dockItems} className="rounded-[1.75rem] px-4 py-3" />

            <div className="flex flex-wrap gap-3">
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <LiquidGlassSurface className="rounded-[1.5rem] p-5 sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Tracking contract
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {DELPHI_PROXY.slice(0, 10)}...{DELPHI_PROXY.slice(-6)}
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Live market discovery, wallet analytics, and archive pages stay tied to Delphi
                activity through the tracked proxy.
              </p>
            </LiquidGlassSurface>

            <LiquidGlassSurface className="rounded-[1.4rem] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Live links
              </p>
              <p className="mt-3 text-xl font-semibold text-white">Delphi + Explorer</p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Jump into the live market surface or audit the contract flow from the explorer.
              </p>
            </LiquidGlassSurface>

            <LiquidGlassSurface className="rounded-[1.4rem] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Built by
              </p>
              <a
                href="https://github.com/xailong-6969"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex text-xl font-semibold text-white hover:text-cyan-200"
              >
                xailong_6969
              </a>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Open the public GitHub profile linked to this Delphi Analytics deployment.
              </p>
            </LiquidGlassSurface>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/6 pt-6 md:flex-row">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            © 2026 Delphi Analytics · Gensyn Testnet
          </div>

          <button
            type="button"
            onClick={scrollToTop}
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-200 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10"
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
      </div>
    </footer>
  );
}
