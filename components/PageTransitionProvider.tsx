"use client";

import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ReactNode, useState, useEffect, useRef } from "react";

interface PageTransitionProviderProps {
  children: ReactNode;
}

export default function PageTransitionProvider({ children }: PageTransitionProviderProps) {
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      // Determine direction based on path depth
      const prevDepth = prevPathRef.current.split("/").length;
      const newDepth = pathname.split("/").length;
      setDirection(newDepth >= prevDepth ? 1 : -1);

      setIsTransitioning(true);

      // After curtain covers screen, swap content
      const swapTimer = setTimeout(() => {
        setDisplayChildren(children);
      }, 350);

      // After content swap, reveal new page
      const revealTimer = setTimeout(() => {
        setIsTransitioning(false);
      }, 400);

      prevPathRef.current = pathname;

      return () => {
        clearTimeout(swapTimer);
        clearTimeout(revealTimer);
      };
    } else {
      setDisplayChildren(children);
    }
  }, [pathname, children]);

  return (
    <div className="relative">
      {/* Transition Curtain */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            className="curtain-overlay"
            initial={{
              clipPath: direction > 0
                ? "polygon(0 0, 0 0, -15% 100%, -15% 100%)"
                : "polygon(115% 0, 115% 0, 100% 100%, 100% 100%)",
            }}
            animate={{
              clipPath: "polygon(-15% 0, 115% 0, 100% 100%, 0% 100%)",
            }}
            exit={{
              clipPath: direction > 0
                ? "polygon(115% 0, 115% 0, 130% 100%, 130% 100%)"
                : "polygon(-15% 0, -15% 0, -30% 100%, -30% 100%)",
            }}
            transition={{
              duration: 0.45,
              ease: [0.76, 0, 0.24, 1],
            }}
          />
        )}
      </AnimatePresence>

      {/* Page Content */}
      <motion.div
        key={pathname}
        initial={{ opacity: 0, filter: "blur(6px)", y: 12 }}
        animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
        transition={{
          duration: 0.5,
          delay: 0.1,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {displayChildren}
      </motion.div>
    </div>
  );
}
