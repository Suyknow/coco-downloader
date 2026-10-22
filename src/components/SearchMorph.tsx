"use client";

import { useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";

type Bounds = { x: number; y: number; width: number; height: number };

/** Keep one surface mounted so either direction starts at its current position. */
export function SearchMorph({ discovery, home, navigation, children }: {
  discovery: boolean;
  home: RefObject<HTMLDivElement | null>;
  navigation: HTMLDivElement | null;
  children: ReactNode;
}) {
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [instant, setInstant] = useState(false);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const target = discovery ? navigation : home.current;
    if (!target) return;
    const measure = (immediate = false) => {
      const rect = target.getBoundingClientRect();
      setInstant(immediate);
      setBounds({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(target);
    const onScroll = () => measure(true);
    const onResize = () => measure(true);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [discovery, home, navigation]);

  if (!bounds) return null;
  return createPortal(<motion.div
    className="search-morph-surface"
    initial={false}
    animate={bounds}
    transition={instant || reduced ? { duration: 0 } : { type: "spring", stiffness: 210, damping: 30, mass: 1 }}
    data-mode={discovery ? "playlist" : "search"}
  >{children}</motion.div>, document.body);
}
