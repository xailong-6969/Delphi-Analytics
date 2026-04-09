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
  { href: "https://github.com/xailong-6969", label: "GITHUB", icon: "↗" },
];

interface FullScreenNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FullScreenNav({ isOpen, onClose }: FullScreenNavProps) {
  const pathname = usePathname();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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
          <motion.div
            className="fullnav-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
          />

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

          <nav className="fullnav-content">
            {navItems.map((item, index) => {
              const isActive = pathname === item.href;
              return (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 60 }}
                  transition={{
                    delay: 0.05 + index * 0.08,
                    duration: 0.5,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  onMouseEnter={() => setHoveredIndex(index)}
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

          <motion.div
            className="fullnav-brand"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <span className="font-semibold text-violet-400">Delphi Analytics</span>
            <span className="text-xs text-zinc-600">Gensyn Testnet</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
