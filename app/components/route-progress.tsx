"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type ProgressPhase = "idle" | "loading" | "complete" | "fading";

export default function RouteProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<ProgressPhase>("idle");
  const phaseRef = useRef<ProgressPhase>("idle");
  const pathnameRef = useRef(pathname);
  const reducedMotionRef = useRef(false);
  const fadeTimerRef = useRef<number | undefined>(undefined);
  const fadeFrameRef = useRef<number | undefined>(undefined);

  const updatePhase = useCallback((nextPhase: ProgressPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const clearFadeTimer = useCallback(() => {
    if (fadeFrameRef.current !== undefined) {
      window.cancelAnimationFrame(fadeFrameRef.current);
      fadeFrameRef.current = undefined;
    }
    if (fadeTimerRef.current !== undefined) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = undefined;
    }
  }, []);

  const fadeOut = useCallback(() => {
    fadeFrameRef.current = window.requestAnimationFrame(() => {
      updatePhase("fading");
      fadeTimerRef.current = window.setTimeout(() => updatePhase("idle"), 200);
    });
  }, [updatePhase]);

  const start = useCallback(() => {
    clearFadeTimer();
    if (reducedMotionRef.current) {
      updatePhase("complete");
      fadeOut();
      return;
    }
    updatePhase("loading");
  }, [clearFadeTimer, fadeOut, updatePhase]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const setReducedMotion = () => {
      reducedMotionRef.current = mediaQuery.matches;
      if (mediaQuery.matches) {
        clearFadeTimer();
        updatePhase("idle");
      }
    };
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;

      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target && anchor.target !== "_self" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || (destination.pathname === window.location.pathname && destination.search === window.location.search)) return;

      start();
    };

    setReducedMotion();
    mediaQuery.addEventListener("change", setReducedMotion);
    document.addEventListener("click", handleClick, true);
    return () => {
      clearFadeTimer();
      mediaQuery.removeEventListener("change", setReducedMotion);
      document.removeEventListener("click", handleClick, true);
    };
  }, [clearFadeTimer, start, updatePhase]);

  useEffect(() => {
    if (pathname !== pathnameRef.current) {
      pathnameRef.current = pathname;
      if (phaseRef.current === "loading") {
        updatePhase("complete");
        fadeOut();
      } else if (phaseRef.current === "idle") {
        updatePhase(reducedMotionRef.current ? "complete" : "loading");
        fadeFrameRef.current = window.requestAnimationFrame(() => {
          updatePhase("complete");
          fadeOut();
        });
      }
    }
  }, [fadeOut, pathname, updatePhase]);

  return <span aria-hidden="true" className={`route-progress route-progress-${phase}`} />;
}
