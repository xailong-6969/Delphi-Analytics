"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { href: "/", label: "HOME", icon: "⌂", stat: "Dashboard" },
  { href: "/markets", label: "MARKETS", icon: "◈", stat: "Market index" },
  { href: "/leaderboard", label: "LEADERBOARD", icon: "△", stat: "Rankings" },
];

const externalLinks = [
  { href: "https://delphi.gensyn.ai", label: "TRADE", icon: "↗" },
  { href: "https://github.com/xailong-6969/Delphi-Analytics", label: "GITHUB", icon: "↗" },
];

interface FullScreenNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FullScreenNav({ isOpen, onClose }: FullScreenNavProps) {
  const pathname = usePathname();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Close on route change
  useEffect(() => {
    onClose();
  }, [pathname]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fullnav-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Glassmorphism background */}
          <motion.div
            className="fullnav-backdrop"
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.4 }}
          />

          {/* Spotlight effect — follows hovered item */}
          {hoveredIndex !== null && (
            <motion.div
              className="fullnav-spotlight"
              animate={{
                y: `${hoveredIndex * 33}%`,
                opacity: 0.6,
              }}
              transition={{ type: "spring", stiffness: 200, damping: 30 }}
            />
          )}

          {/* Close button */}
          <motion.button
            className="fullnav-close"
            onClick={onClose}
            initial={{ opacity: 0, rotate: -90 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 90 }}
            transition={{ delay: 0.1 }}
            aria-label="Close navigation"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </motion.button>

          {/* Main nav items */}
          <nav className="fullnav-content">
            {navItems.map((item, idx) => {
              const isActive = pathname === item.href;
              return (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -60, filter: "blur(8px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, x: 60, filter: "blur(8px)" }}
                  transition={{ delay: 0.05 + idx * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`fullnav-link ${isActive ? "fullnav-link-active" : ""}`}
                  >
                    <span className="fullnav-link-icon">{item.icon}</span>
                    <span className="fullnav-link-label">{item.label}</span>
                    <span className="fullnav-link-stat">{item.stat}</span>
                    <span className="fullnav-link-arrow">→</span>
                  </Link>
                </motion.div>
              );
            })}
          </nav>

          {/* External links */}
          <motion.div
            className="fullnav-external"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            {externalLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="fullnav-ext-link"
              >
                {link.label}
                <span className="fullnav-ext-icon">{link.icon}</span>
              </a>
            ))}
          </motion.div>

          {/* Bottom branding */}
          <motion.div
            className="fullnav-brand"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <span className="text-violet-400 font-semibold">Delphi Analytics</span>
            <span className="text-zinc-600 text-xs">Gensyn Testnet</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
