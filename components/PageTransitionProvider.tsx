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
                y: 12,
              }
        }
        animate={
          reduceMotion
            ? { opacity: 1 }
            : {
                opacity: 1,
                y: 0,
              }
        }
        exit={
          reduceMotion
            ? { opacity: 0 }
            : {
                opacity: 0,
                y: -8,
              }
        }
        transition={
          reduceMotion
            ? { duration: 0.14 }
            : {
                y: {
                  duration: 0.2,
                  ease: [0.22, 1, 0.36, 1],
                },
                opacity: {
                  duration: 0.18,
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
