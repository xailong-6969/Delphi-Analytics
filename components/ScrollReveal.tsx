"use client";

import { useRef, useEffect, useState, ReactNode } from "react";
import { motion, useAnimation, useReducedMotion } from "framer-motion";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right";
  blur?: boolean;
  distance?: number;
  duration?: number;
  scale?: number;
}

export default function ScrollReveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
  blur = true,
  distance = 30,
  duration = 0.7,
  scale = 0.985,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const [hasRevealed, setHasRevealed] = useState(false);
  const reduceMotion = useReducedMotion();

  const getInitial = () => {
    if (reduceMotion) {
      return { opacity: 0 };
    }
    switch (direction) {
      case "left":
        return {
          opacity: 0,
          x: -distance,
          scale,
        };
      case "right":
        return {
          opacity: 0,
          x: distance,
          scale,
        };
      default:
        return {
          opacity: 0,
          y: distance,
          scale,
        };
    }
  };

  const getAnimate = () => {
    if (reduceMotion) {
      return { opacity: 1 };
    }
    switch (direction) {
      case "left":
      case "right":
        return { opacity: 1, x: 0, scale: 1 };
      default:
        return { opacity: 1, y: 0, scale: 1 };
    }
  };

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasRevealed) {
          setHasRevealed(true);
          controls.start(getAnimate());
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [controls, hasRevealed]);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={getInitial()}
      animate={controls}
      transition={{
        duration: reduceMotion ? 0.18 : duration,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

// Staggered container for child reveals
interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggerContainer({
  children,
  className = "",
  staggerDelay = 0.08,
}: StaggerContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const [hasRevealed, setHasRevealed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasRevealed) {
          setHasRevealed(true);
          controls.start("visible");
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [controls, hasRevealed]);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={controls}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

// Individual stagger child
export function StaggerItem({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.99 },
        visible: {
          opacity: 1,
          ...(reduceMotion ? {} : { y: 0, scale: 1 }),
          transition: { duration: reduceMotion ? 0.18 : 0.42, ease: [0.22, 1, 0.36, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
