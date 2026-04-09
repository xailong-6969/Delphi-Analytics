"use client";

import Link from "next/link";
import React from "react";
import { cn } from "@/lib/utils";

interface LiquidGlassSurfaceProps {
  children: React.ReactNode;
  className?: string;
}

interface LiquidGlassButtonProps {
  children: React.ReactNode;
  className?: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
}

interface LiquidGlassDockItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  external?: boolean;
  onClick?: () => void;
}

interface LiquidGlassDockProps {
  items: LiquidGlassDockItem[];
  className?: string;
}

export function LiquidGlassFilter() {
  return (
    <svg aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
      <filter
        id="delphi-liquid-glass"
        x="0%"
        y="0%"
        width="100%"
        height="100%"
        filterUnits="objectBoundingBox"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.003 0.014"
          numOctaves="1"
          seed="19"
          result="turbulence"
        />
        <feGaussianBlur in="turbulence" stdDeviation="1.6" result="softMap" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="softMap"
          scale="18"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}

export function LiquidGlassSurface({
  children,
  className,
}: LiquidGlassSurfaceProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[rgba(14,18,28,0.24)] text-white shadow-[0_18px_44px_rgba(2,6,23,0.18)] backdrop-blur-[8px]",
        className
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          backdropFilter: "blur(4px) saturate(1.08)",
          WebkitBackdropFilter: "blur(4px) saturate(1.08)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.035) 28%, rgba(255,255,255,0.01) 56%, transparent 82%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          boxShadow:
            "inset 1px 1px 0 rgba(255,255,255,0.16), inset -1px -1px 0 rgba(255,255,255,0.02)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function LiquidGlassButton({
  children,
  className,
  href,
  external = false,
  onClick,
  variant = "secondary",
}: LiquidGlassButtonProps) {
  const variantClass = {
    primary:
      "border-[rgba(246,201,120,0.28)] bg-[linear-gradient(135deg,rgba(246,201,120,0.18),rgba(96,165,250,0.12))] text-white shadow-[0_14px_28px_rgba(96,165,250,0.14)]",
    secondary:
      "border-white/12 bg-[rgba(255,255,255,0.035)] text-zinc-100 shadow-[0_14px_28px_rgba(2,6,23,0.12)]",
    ghost:
      "border-cyan-400/18 bg-[rgba(103,232,249,0.035)] text-cyan-100 shadow-[0_14px_28px_rgba(2,6,23,0.1)]",
  }[variant];

  const content = (
    <LiquidGlassSurface
      className={cn(
        "group rounded-full px-5 py-3 transition-all duration-220 hover:-translate-y-0.5 hover:border-white/20",
        variantClass,
        className
      )}
    >
      <span className="relative z-10 inline-flex items-center gap-2 font-medium tracking-[0.01em]">
        {children}
      </span>
    </LiquidGlassSurface>
  );

  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        {content}
      </a>
    );
  }

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return (
    <button type="button" onClick={onClick}>
      {content}
    </button>
  );
}

export function LiquidGlassDock({ items, className }: LiquidGlassDockProps) {
  return (
    <LiquidGlassSurface className={cn("rounded-[1.75rem] px-3 py-2.5", className)}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {items.map((item) => {
          const shell = (
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.06)] text-zinc-100 transition-transform duration-300 hover:scale-105">
              {item.icon}
            </span>
          );

          if (item.href && item.external) {
            return (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={item.label}
                title={item.label}
              >
                {shell}
              </a>
            );
          }

          if (item.href) {
            return (
              <Link key={item.label} href={item.href} aria-label={item.label} title={item.label}>
                {shell}
              </Link>
            );
          }

          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              aria-label={item.label}
              title={item.label}
            >
              {shell}
            </button>
          );
        })}
      </div>
    </LiquidGlassSurface>
  );
}
