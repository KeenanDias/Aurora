"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { useTheme } from "next-themes"

/**
 * Dark mode: canvas-rendered twinkling starfield + three drifting aurora mesh blobs.
 * Light mode: subtle frost gradient with two faint pastel washes (yellow/aqua).
 *
 * The component fixed-positions itself behind everything and is non-interactive.
 *
 * Hydration: useTheme returns undefined on the server, so we render a neutral
 * background until mount to avoid SSR/CSR mismatches.
 */
export function StarryBackground() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === "dark"

  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {!mounted ? (
        // Neutral fallback until theme resolves — uses CSS var so it adapts to whatever
        // theme is finally applied (no flash)
        <div className="absolute inset-0 bg-background" />
      ) : isDark ? (
        <DarkScene />
      ) : (
        <LightScene />
      )}
    </div>
  )
}

function DarkScene() {
  return (
    <>
      {/* Solid obsidian base */}
      <div className="absolute inset-0 bg-[var(--aurora-obsidian)]" />

      {/* Drifting aurora blobs */}
      <MeshBlob
        className="bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.55),transparent_60%)]"
        initial={{ x: "-15%", y: "-10%" }}
        animate={{
          x: ["-15%", "10%", "-5%", "-15%"],
          y: ["-10%", "5%", "-15%", "-10%"],
          scale: [1, 1.15, 0.95, 1],
        }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
        style={{ top: "-10%", left: "-10%", width: "55vw", height: "55vw" }}
      />
      <MeshBlob
        className="bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.5),transparent_60%)]"
        initial={{ x: "10%", y: "5%" }}
        animate={{
          x: ["10%", "-10%", "15%", "10%"],
          y: ["5%", "-5%", "10%", "5%"],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }}
        style={{ top: "10%", right: "-15%", width: "55vw", height: "50vw" }}
      />
      <MeshBlob
        className="bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.45),transparent_65%)]"
        initial={{ x: "-5%", y: "5%" }}
        animate={{
          x: ["-5%", "8%", "-10%", "-5%"],
          y: ["5%", "-10%", "8%", "5%"],
          scale: [1, 1.1, 0.95, 1],
        }}
        transition={{ duration: 40, repeat: Infinity, ease: "easeInOut" }}
        style={{ bottom: "-15%", left: "20%", width: "60vw", height: "55vw" }}
      />

      {/* Twinkling starfield on canvas */}
      <Starfield />

      {/* Soft top vignette so headers stay legible */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[var(--aurora-obsidian)] to-transparent" />
    </>
  )
}

function LightScene() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #f8fafc 0%, #eff6ff 25%, #e0f2fe 60%, #f0f9ff 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 65% 45% at 25% 8%, rgba(224, 242, 254, 0.85), transparent 65%),
            radial-gradient(ellipse 55% 40% at 80% 22%, rgba(186, 230, 253, 0.6), transparent 65%),
            radial-gradient(ellipse 70% 50% at 50% 100%, rgba(191, 219, 254, 0.5), transparent 70%)
          `,
        }}
      />
      <SnowFall />
    </>
  )
}

function SnowFall() {
  const flakes = useMemo(() => {
    const seed = (i: number) => Math.abs((Math.sin(i * 12345) * 9999) % 1)
    return Array.from({ length: 55 }, (_, i) => ({
      left: seed(i) * 100,
      delay: seed(i + 50) * 14,
      duration: 18 + seed(i + 100) * 16,
      size: 10 + seed(i + 150) * 18,
      drift: -28 + seed(i + 200) * 56,
      sway: 8 + seed(i + 250) * 14,
      opacity: 0.5 + seed(i + 300) * 0.45,
      variant: Math.floor(seed(i + 350) * 3),
      spinDir: seed(i + 400) > 0.5 ? 1 : -1,
    }))
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden">
      {flakes.map((f, i) => {
        const blur = f.size > 22 ? 0.4 : f.size < 13 ? 0.6 : 0
        return (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: `${f.left}%`,
              top: "-8%",
              width: `${f.size}px`,
              height: `${f.size}px`,
              filter: `drop-shadow(0 0 4px rgba(186,230,253,0.7)) drop-shadow(0 0 8px rgba(125,211,252,0.35))${blur ? ` blur(${blur}px)` : ""}`,
            }}
            animate={{
              y: ["0vh", "112vh"],
              x: [0, f.sway, -f.sway, f.drift],
              opacity: [0, f.opacity, f.opacity, 0],
              rotate: [0, f.spinDir * 360],
            }}
            transition={{
              duration: f.duration,
              delay: f.delay,
              repeat: Infinity,
              ease: "linear",
              times: [0, 0.15, 0.85, 1],
            }}
          >
            <Snowflake variant={f.variant} />
          </motion.div>
        )
      })}
    </div>
  )
}

function Snowflake({ variant }: { variant: number }) {
  const stroke = "rgba(255,255,255,0.95)"
  const accent = "rgba(219,234,254,0.85)"
  return (
    <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
      <g stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" transform="translate(20 20)">
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <g key={angle} transform={`rotate(${angle})`}>
            <line x1="0" y1="0" x2="0" y2="-17" />
            {variant === 0 && (
              <>
                <line x1="0" y1="-12" x2="-3.5" y2="-16" />
                <line x1="0" y1="-12" x2="3.5" y2="-16" />
                <line x1="0" y1="-7" x2="-2.5" y2="-10" />
                <line x1="0" y1="-7" x2="2.5" y2="-10" />
              </>
            )}
            {variant === 1 && (
              <>
                <line x1="0" y1="-9" x2="-4" y2="-13" />
                <line x1="0" y1="-9" x2="4" y2="-13" />
                <line x1="-4" y1="-13" x2="0" y2="-17" stroke={accent} />
                <line x1="4" y1="-13" x2="0" y2="-17" stroke={accent} />
                <line x1="0" y1="-4" x2="-2" y2="-6" />
                <line x1="0" y1="-4" x2="2" y2="-6" />
              </>
            )}
            {variant === 2 && (
              <>
                <line x1="0" y1="-14" x2="-3" y2="-11" />
                <line x1="0" y1="-14" x2="3" y2="-11" />
                <line x1="0" y1="-10" x2="-2.5" y2="-7.5" />
                <line x1="0" y1="-10" x2="2.5" y2="-7.5" />
                <line x1="0" y1="-6" x2="-2" y2="-4" />
                <line x1="0" y1="-6" x2="2" y2="-4" />
              </>
            )}
          </g>
        ))}
        <circle r="1.6" fill={stroke} stroke="none" />
      </g>
    </svg>
  )
}

function MeshBlob({
  className,
  style,
  ...motionProps
}: {
  className?: string
  style?: React.CSSProperties
} & Omit<React.ComponentProps<typeof motion.div>, "className" | "style">) {
  return (
    <motion.div
      {...motionProps}
      style={{ position: "absolute", filter: "blur(80px)", ...style }}
      className={`rounded-full ${className ?? ""}`}
    />
  )
}

function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let stars: { x: number; y: number; r: number; baseAlpha: number; phase: number; speed: number }[] = []

    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`

      const count = Math.floor((window.innerWidth * window.innerHeight) / 6000)
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: (Math.random() * 1.2 + 0.3) * dpr,
        baseAlpha: Math.random() * 0.5 + 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.6 + 0.2,
      }))
    }

    let frame = 0
    const draw = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const s of stars) {
        const twinkle = Math.sin(t * 0.001 * s.speed + s.phase) * 0.4 + 0.6
        const alpha = s.baseAlpha * twinkle
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(226, 232, 255, ${alpha.toFixed(3)})`
        ctx.fill()
      }
      frame = requestAnimationFrame(draw)
    }

    resize()
    frame = requestAnimationFrame(draw)
    window.addEventListener("resize", resize)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
}
