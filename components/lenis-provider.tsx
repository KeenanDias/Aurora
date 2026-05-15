"use client"

import { useEffect } from "react"
import Lenis from "lenis"

/**
 * Global smooth scrolling with Lenis. Mounted once at the root.
 * Respects prefers-reduced-motion.
 *
 * Exposes the instance on `window.__lenis` so modals can pause it
 * (calling `stop()`) — Lenis hijacks wheel events, so `overflow: hidden`
 * alone isn't enough to lock background scroll.
 */
declare global {
  interface Window {
    __lenis?: Lenis
  }
}

export function LenisProvider() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
    })
    window.__lenis = lenis

    let frame = 0
    const raf = (time: number) => {
      lenis.raf(time)
      frame = requestAnimationFrame(raf)
    }
    frame = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(frame)
      lenis.destroy()
      delete window.__lenis
    }
  }, [])

  return null
}
