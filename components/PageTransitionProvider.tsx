"use client";

import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";

interface PageTransitionProviderProps {
  children: ReactNode;
}

export default function PageTransitionProvider({ children }: PageTransitionProviderProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        className="page-transition-frame"
        initial={
          reduceMotion
            ? { opacity: 0 }
            : {
                opacity: 0,
                scale: 0.985,
                y: 18,
                filter: "blur(12px) saturate(0.92)",
              }
        }
        animate={
          reduceMotion
            ? { opacity: 1 }
            : {
                opacity: 1,
                scale: 1,
                y: 0,
                filter: "blur(0px) saturate(1)",
              }
        }
        exit={
          reduceMotion
            ? { opacity: 0 }
            : {
                opacity: 0,
                scale: 1.008,
                y: -10,
                filter: "blur(8px) saturate(0.95)",
              }
        }
        transition={
          reduceMotion
            ? { duration: 0.14 }
            : {
                scale: {
                  type: "spring",
                  stiffness: 260,
                  damping: 28,
                  mass: 0.86,
                },
                y: {
                  type: "spring",
                  stiffness: 240,
                  damping: 28,
                  mass: 0.86,
                },
                opacity: {
                  duration: 0.22,
                  ease: [0.22, 1, 0.36, 1],
                },
                filter: {
                  duration: 0.22,
                  ease: [0.22, 1, 0.36, 1],
                },
              }
        }
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
