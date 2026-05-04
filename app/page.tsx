"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import Link from "next/link"
import { motion, useScroll, useTransform, useInView, MotionValue, useSpring, AnimatePresence } from "framer-motion"
import { useTheme } from "next-themes"
import { useAuth } from "@clerk/nextjs"
import { Lock, Shield, Flame, Send, Sparkles, ArrowRight, Check, MessageSquare } from "lucide-react"
import { EarlyAccessForm } from "@/components/early-access-form"
import { ThemeToggle } from "@/components/theme-toggle"

/**
 * Aurora landing — a 5-scene "fly-through" the Northern Lights.
 *
 * Architecture:
 *   - Single tall scroll container split into stacked scenes
 *   - Each scene is a `sticky` viewport-height frame whose contents animate via useScroll
 *   - A global parallax starfield drifts in the background at 3 z-depths
 *   - Last scene morphs the theme dark → light for the "Arctic Dawn" CTA
 */
export default function LandingPage() {
  const { isSignedIn } = useAuth()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const containerRef = useRef<HTMLDivElement | null>(null)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] })

  // Smoothed scroll for buttery transforms (also lets Lenis dictate feel)
  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 22, mass: 0.4 })

  // ── Camera "Z" — drives parallax zoom into the starfield as the user scrolls
  const cameraZ = useTransform(smooth, [0, 1], [0, 1500])

  // ── Background mesh tints (dark mode only) drift over the sky as you scroll
  const bgEmerald = useTransform(smooth, [0, 0.45], [0.55, 0.15])
  const bgViolet = useTransform(smooth, [0.3, 0.85], [0.1, 0.55])
  const bgTeal = useTransform(smooth, [0.1, 0.6], [0.35, 0.55])

  const isDark = resolvedTheme !== "light"

  return (
    <div ref={containerRef} className="relative">
      {/* Background is mounted-only to avoid SSR/CSR hydration mismatches */}
      {mounted && (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          {isDark ? (
            <>
              {/* Obsidian sky */}
              <div className="absolute inset-0 bg-[#020617]" />

              {/* Drifting mesh blobs */}
              <motion.div
                className="absolute inset-0 will-change-[opacity]"
                style={{
                  background:
                    "radial-gradient(ellipse 70% 50% at 30% 20%, rgba(16,185,129,0.6), transparent 60%)",
                  opacity: bgEmerald,
                }}
              />
              <motion.div
                className="absolute inset-0 will-change-[opacity]"
                style={{
                  background:
                    "radial-gradient(ellipse 60% 45% at 70% 35%, rgba(20,184,166,0.5), transparent 60%)",
                  opacity: bgTeal,
                }}
              />
              <motion.div
                className="absolute inset-0 will-change-[opacity]"
                style={{
                  background:
                    "radial-gradient(ellipse 70% 50% at 70% 70%, rgba(139,92,246,0.5), transparent 60%)",
                  opacity: bgViolet,
                }}
              />

              {/* Aurora borealis trails (greenish-blueish ribbons) */}
              <AuroraTrails />

              {/* Canvas starfield — bright, performant, no hydration concerns */}
              <CanvasStarfield cameraZ={cameraZ} />
            </>
          ) : (
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
              <SnowFlecks />
            </>
          )}
        </div>
      )}

      <div className="relative z-10">
        <TopNav signedIn={!!isSignedIn} />
        <SceneGuardian />
        <SceneVault />
        <ScenePulse />
        <SceneChat />
        <SceneDawn />
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Top Nav
// ════════════════════════════════════════════════════════════════════════
function TopNav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-aurora-emerald via-aurora-teal to-aurora-violet rounded-xl flex items-center justify-center shadow-lg shadow-aurora-teal/30">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="font-bold text-xl bg-gradient-to-r from-aurora-emerald via-aurora-teal to-aurora-violet bg-clip-text text-transparent">
            Aurora
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href={signedIn ? "/dashboard" : "/sign-in"}
            className="text-sm text-foreground/70 hover:text-foreground transition-colors"
          >
            {signedIn ? "Open dashboard →" : "Sign in"}
          </Link>
        </div>
      </div>
    </header>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Canvas Starfield — 3 conceptual depth layers, twinkles + parallax zoom
// Rendered post-mount on canvas → no hydration drift, brighter, smoother.
// ════════════════════════════════════════════════════════════════════════
function CanvasStarfield({ cameraZ }: { cameraZ: MotionValue<number> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    type Star = {
      x: number
      y: number
      r: number
      depth: 0 | 1 | 2 // 0 = far, 1 = mid, 2 = near
      phase: number
      twinkleSpeed: number
    }
    let stars: Star[] = []

    const populate = () => {
      const W = canvas.width
      const H = canvas.height
      // Density tuned so a 1080p screen gets ~600 stars total
      const total = Math.floor((W * H) / 4500)
      const farCount = Math.floor(total * 0.55)
      const midCount = Math.floor(total * 0.30)
      const nearCount = total - farCount - midCount

      stars = []
      for (let i = 0; i < farCount; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: (0.6 + Math.random() * 0.6) * dpr,
          depth: 0,
          phase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.3 + Math.random() * 0.5,
        })
      }
      for (let i = 0; i < midCount; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: (1.0 + Math.random() * 0.8) * dpr,
          depth: 1,
          phase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.4 + Math.random() * 0.6,
        })
      }
      for (let i = 0; i < nearCount; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: (1.6 + Math.random() * 1.4) * dpr,
          depth: 2,
          phase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.5 + Math.random() * 0.7,
        })
      }
    }

    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      populate()
    }

    let frame = 0
    const draw = (t: number) => {
      const z = cameraZ.get() // 0 → 1500
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Camera-Z scales each depth layer differently (parallax)
      const cx = canvas.width / 2
      const cy = canvas.height / 2

      for (const s of stars) {
        const layerScale = s.depth === 0 ? 1 + z * 0.0003 : s.depth === 1 ? 1 + z * 0.0009 : 1 + z * 0.002
        // Far/mid layers fade out as we zoom past them
        const layerFade =
          s.depth === 0 ? Math.max(0, 1 - (z - 800) / 700) :
          s.depth === 1 ? Math.max(0, 1 - (z - 600) / 800) :
          1

        const px = cx + (s.x - cx) * layerScale
        const py = cy + (s.y - cy) * layerScale

        if (px < -20 || px > canvas.width + 20 || py < -20 || py > canvas.height + 20) continue

        const twinkle = Math.sin(t * 0.001 * s.twinkleSpeed + s.phase) * 0.4 + 0.6
        const baseAlpha = s.depth === 0 ? 0.55 : s.depth === 1 ? 0.85 : 1
        const alpha = baseAlpha * twinkle * layerFade

        const tint =
          s.depth === 2 ? "rgba(167, 243, 208" : // emerald-200 for foreground stars
          s.depth === 1 ? "rgba(226, 232, 255" : // soft white-blue
          "rgba(203, 213, 225" // far stars dimmer

        if (s.depth === 0) {
          // Far stars: simple dots
          ctx.beginPath()
          ctx.arc(px, py, s.r, 0, Math.PI * 2)
          ctx.fillStyle = `${tint}, ${alpha.toFixed(3)})`
          ctx.fill()
        } else {
          // Mid + near: render as proper twinkling stars with cross spikes
          const spikeLen = s.depth === 2 ? s.r * 6 : s.r * 4
          const spikeWidth = s.depth === 2 ? s.r * 0.45 : s.r * 0.35
          const haloRadius = s.depth === 2 ? s.r * 3.5 : s.r * 2.2

          // Soft radial halo
          const grad = ctx.createRadialGradient(px, py, 0, px, py, haloRadius)
          grad.addColorStop(0, `${tint}, ${(alpha * 0.55).toFixed(3)})`)
          grad.addColorStop(0.4, `${tint}, ${(alpha * 0.18).toFixed(3)})`)
          grad.addColorStop(1, `${tint}, 0)`)
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(px, py, haloRadius, 0, Math.PI * 2)
          ctx.fill()

          // Cross spikes (horizontal + vertical), brightness tied to twinkle
          const spikeGrad = ctx.createLinearGradient(px - spikeLen, py, px + spikeLen, py)
          spikeGrad.addColorStop(0, `${tint}, 0)`)
          spikeGrad.addColorStop(0.5, `${tint}, ${(alpha * 0.9).toFixed(3)})`)
          spikeGrad.addColorStop(1, `${tint}, 0)`)
          ctx.fillStyle = spikeGrad
          ctx.fillRect(px - spikeLen, py - spikeWidth / 2, spikeLen * 2, spikeWidth)

          const spikeGradV = ctx.createLinearGradient(px, py - spikeLen, px, py + spikeLen)
          spikeGradV.addColorStop(0, `${tint}, 0)`)
          spikeGradV.addColorStop(0.5, `${tint}, ${(alpha * 0.9).toFixed(3)})`)
          spikeGradV.addColorStop(1, `${tint}, 0)`)
          ctx.fillStyle = spikeGradV
          ctx.fillRect(px - spikeWidth / 2, py - spikeLen, spikeWidth, spikeLen * 2)

          // Bright core
          ctx.beginPath()
          ctx.arc(px, py, s.r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`
          ctx.fill()
        }
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
  }, [cameraZ])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
}

// ════════════════════════════════════════════════════════════════════════
// Aurora Borealis Trails (dark mode) — drifting greenish-blue ribbons
// ════════════════════════════════════════════════════════════════════════
function AuroraTrails() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Three SVG ribbons, each drifting + pulsing on its own clock */}
      <Trail
        path="M -100 200 Q 300 80, 700 200 T 1500 180"
        gradientId="auroraTrail1"
        from="#34d399"
        via="#22d3ee"
        to="#8b5cf6"
        duration={22}
        delay={0}
        topPct={18}
        opacity={0.55}
      />
      <Trail
        path="M -100 250 Q 400 120, 800 280 T 1600 220"
        gradientId="auroraTrail2"
        from="#10b981"
        via="#06b6d4"
        to="#10b981"
        duration={28}
        delay={4}
        topPct={42}
        opacity={0.4}
      />
      <Trail
        path="M -100 180 Q 500 50, 900 220 T 1700 160"
        gradientId="auroraTrail3"
        from="#14b8a6"
        via="#34d399"
        to="#06b6d4"
        duration={34}
        delay={9}
        topPct={68}
        opacity={0.35}
      />
    </div>
  )
}

function Trail({
  path,
  gradientId,
  from,
  via,
  to,
  duration,
  delay,
  topPct,
  opacity,
}: {
  path: string
  gradientId: string
  from: string
  via: string
  to: string
  duration: number
  delay: number
  topPct: number
  opacity: number
}) {
  return (
    <motion.div
      className="absolute inset-x-0 will-change-transform"
      style={{ top: `${topPct}%`, height: "300px", filter: "blur(28px)" }}
      animate={{
        x: ["-5%", "3%", "-3%", "-5%"],
        y: [0, -16, 8, 0],
        opacity: [opacity * 0.6, opacity, opacity * 0.7, opacity * 0.6],
      }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      <svg viewBox="0 0 1600 400" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={from} stopOpacity="0" />
            <stop offset="25%" stopColor={from} stopOpacity="1" />
            <stop offset="50%" stopColor={via} stopOpacity="1" />
            <stop offset="75%" stopColor={to} stopOpacity="1" />
            <stop offset="100%" stopColor={to} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={path} stroke={`url(#${gradientId})`} strokeWidth="120" strokeLinecap="round" fill="none" />
      </svg>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// SnowFlecks (light mode) — slow, soft drifting motes
// ════════════════════════════════════════════════════════════════════════
function SnowFlecks() {
  const flakes = useMemo(() => {
    const seed = (i: number) => Math.abs((Math.sin(i * 12345) * 9999) % 1)
    return Array.from({ length: 55 }, (_, i) => ({
      left: seed(i) * 100,
      delay: seed(i + 50) * 14,
      duration: 18 + seed(i + 100) * 16,
      size: 10 + seed(i + 150) * 18, // 10–28px crystal
      drift: -28 + seed(i + 200) * 56,
      sway: 8 + seed(i + 250) * 14,
      opacity: 0.5 + seed(i + 300) * 0.45,
      variant: Math.floor(seed(i + 350) * 3), // 0,1,2
      spinDir: seed(i + 400) > 0.5 ? 1 : -1,
    }))
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden">
      {flakes.map((f, i) => {
        const depth = f.size > 20 ? "near" : f.size > 14 ? "mid" : "far"
        const blur = depth === "near" ? 0.4 : depth === "far" ? 0.6 : 0
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
  // Three subtly different 6-fold crystal designs
  const stroke = "rgba(255,255,255,0.95)"
  const accent = "rgba(219,234,254,0.85)"
  return (
    <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
      <g
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(20 20)"
      >
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <g key={angle} transform={`rotate(${angle})`}>
            {/* Main spoke */}
            <line x1="0" y1="0" x2="0" y2="-17" />
            {variant === 0 && (
              <>
                {/* V-tips */}
                <line x1="0" y1="-12" x2="-3.5" y2="-16" />
                <line x1="0" y1="-12" x2="3.5" y2="-16" />
                <line x1="0" y1="-7" x2="-2.5" y2="-10" />
                <line x1="0" y1="-7" x2="2.5" y2="-10" />
              </>
            )}
            {variant === 1 && (
              <>
                {/* Diamond + branches */}
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
                {/* Feathered crystal */}
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
        {/* Center hex */}
        <circle r="1.6" fill={stroke} stroke="none" />
      </g>
    </svg>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Scene 1 — Guardian / Hero
// ════════════════════════════════════════════════════════════════════════
function SceneGuardian() {
  const ref = useRef<HTMLDivElement | null>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })

  const phoneScale = useTransform(scrollYProgress, [0, 1], [1, 0.4])
  const phoneOpacity = useTransform(scrollYProgress, [0, 0.7, 1], [1, 1, 0])
  const phoneRotate = useTransform(scrollYProgress, [0, 1], [0, 12])
  const headlineY = useTransform(scrollYProgress, [0, 1], [0, -120])
  const headlineOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])

  return (
    <section ref={ref} className="relative h-[200vh]">
      <div className="sticky top-0 h-screen flex items-center justify-center px-6 overflow-hidden">
        <div className="max-w-6xl w-full grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          {/* Headline */}
          <motion.div
            style={{ y: headlineY, opacity: headlineOpacity }}
            className="relative z-10"
          >
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-aurora-emerald/30 bg-aurora-emerald/[0.08] text-aurora-emerald text-xs font-medium mb-6"
            >
              <Sparkles className="w-3 h-3" />
              Closed beta · 50 spots
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
              className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-foreground"
              style={{ textShadow: "var(--heading-shadow)" }}
            >
              Your money needs a{" "}
              <span className="bg-gradient-to-r from-aurora-emerald via-aurora-teal to-aurora-violet bg-clip-text text-transparent">
                bodyguard
              </span>
              , not a spreadsheet.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-lg sm:text-xl text-foreground/80 mt-6 max-w-xl leading-relaxed"
            >
              Aurora is an AI financial coach that stops you from blowing the rent,
              earns you points for staying disciplined, and tells you when it&apos;s
              actually okay to spend.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="mt-8 flex flex-col sm:flex-row gap-3"
            >
              <Link href="#cta" className="group relative inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-medium overflow-hidden">
                <span className="absolute inset-0 bg-gradient-to-r from-aurora-emerald via-aurora-teal to-aurora-violet" />
                <span className="absolute inset-[1px] rounded-full bg-background/85 backdrop-blur" />
                <span className="absolute inset-0 rounded-full bg-gradient-to-r from-aurora-emerald via-aurora-teal to-aurora-violet opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative flex items-center gap-2 text-foreground group-hover:text-white transition-colors">
                  Join the closed beta
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
              <a
                href="#chat"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full border border-border text-foreground/80 font-medium hover:bg-muted/60 hover:text-foreground transition-all"
              >
                See it talk
              </a>
            </motion.div>
          </motion.div>

          {/* Phone mockup */}
          <motion.div
            style={{ scale: phoneScale, opacity: phoneOpacity, rotate: phoneRotate }}
            className="relative flex justify-center"
          >
            <PhoneMockup />
          </motion.div>
        </div>

        <ScrollHint />
      </div>
    </section>
  )
}

function PhoneMockup() {
  return (
    <div className="relative w-[280px] h-[560px]">
      {/* Glow */}
      <div className="absolute -inset-8 bg-gradient-to-br from-aurora-emerald/30 via-aurora-teal/20 to-aurora-violet/30 rounded-[3rem] blur-3xl" />

      {/* Phone frame */}
      <div className="relative w-full h-full rounded-[2.5rem] border border-border bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)]">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black/60 rounded-b-2xl z-10" />

        {/* Screen content — encryption shackle loop */}
        <div className="absolute inset-3 rounded-[2rem] bg-gradient-to-b from-obsidian via-obsidian to-[#0d1526] flex flex-col items-center justify-center p-6">
          <ShackleAnimation />
          <p className="text-white text-base font-medium mt-6">Securing your data</p>
          <p className="text-muted-foreground text-xs mt-1">AES-256 · Zero-knowledge</p>

          <div className="absolute bottom-8 left-6 right-6 space-y-2">
            <SecurityRow label="Encrypting statement" />
            <SecurityRow label="Verifying transit code" delay={0.6} />
            <SecurityRow label="Sealing the vault" delay={1.2} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ShackleAnimation() {
  return (
    <div className="relative w-24 h-24">
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{
          scale: [1, 1.05, 1, 1.05, 1],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute w-full h-full rounded-full bg-aurora-emerald/30 blur-2xl" />
        <motion.div
          animate={{ rotate: [0, -8, 0, 0, 0] }}
          transition={{ duration: 3, repeat: Infinity, times: [0, 0.2, 0.4, 0.7, 1] }}
          className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-aurora-emerald to-aurora-teal flex items-center justify-center shadow-lg shadow-aurora-emerald/40"
        >
          <Lock className="w-8 h-8 text-white" />
        </motion.div>
      </motion.div>
    </div>
  )
}

function SecurityRow({ label, delay = 0 }: { label: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="flex items-center gap-2 text-[11px] text-foreground/80"
    >
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, delay }}
        className="w-1.5 h-1.5 rounded-full bg-aurora-emerald shadow-[0_0_6px_rgba(16,185,129,0.8)]"
      />
      {label}
    </motion.div>
  )
}

function ScrollHint() {
  return (
    <motion.div
      animate={{ y: [0, 8, 0], opacity: [0.4, 0.8, 0.4] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 text-foreground/80 text-xs flex flex-col items-center gap-2"
    >
      Scroll to fly
      <div className="w-5 h-8 rounded-full border border-white/30 flex items-start justify-center pt-1.5">
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-1 h-1.5 rounded-full bg-white/80"
        />
      </div>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Scene 2 — Vault (Constellation of Trust)
// ════════════════════════════════════════════════════════════════════════
function SceneVault() {
  const ref = useRef<HTMLDivElement | null>(null)
  const inView = useInView(ref, { amount: 0.5, once: false })

  return (
    <section ref={ref} className="relative h-[150vh]">
      <div className="sticky top-0 h-screen flex items-center px-6">
        <div className="max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-16 items-center">
          {/* Animated shield */}
          <div className="relative flex justify-center order-2 lg:order-1">
            <ShieldConstellation active={inView} />
          </div>

          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            viewport={{ once: false, amount: 0.4 }}
            className="order-1 lg:order-2"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-aurora-violet/30 bg-aurora-violet/[0.08] text-aurora-violet text-xs font-medium mb-6">
              <Shield className="w-3 h-3" />
              The Vault
            </span>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.05] tracking-tight"
              style={{ textShadow: "var(--heading-shadow)" }}>
              Bank grade by design.
            </h2>
            <p className="text-lg text-foreground/80 mt-6 max-w-lg leading-relaxed">
              Statements live behind <strong className="text-foreground">AES-256 encryption</strong>.
              Every PDF is verified against the Canadian Payment Association
              <strong className="text-foreground"> CPA-005 standard</strong> the same one your
              bank uses. We match the transit code on your statement before any data
              touches the engine.
            </p>
            <ul className="mt-8 space-y-3">
              <FeatureCheck text="AES-256-GCM at rest, TLS 1.3 in transit" />
              <FeatureCheck text="Transit-code verification (TD/RBC/BMO/Scotia + more)" />
              <FeatureCheck text="Zero-knowledge |  you can wipe everything in one click" />
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function ShieldConstellation({ active }: { active: boolean }) {
  return (
    <div className="relative w-[320px] h-[320px] sm:w-[400px] sm:h-[400px]">
      {/* Halo */}
      <motion.div
        animate={active ? { scale: [1, 1.1, 1], opacity: [0.4, 0.7, 0.4] } : { opacity: 0.3 }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-full bg-gradient-to-br from-aurora-emerald/30 via-aurora-violet/30 to-aurora-teal/30 blur-3xl"
      />

      {/* Shield outline that "snaps shut" */}
      <motion.svg
        viewBox="0 0 200 200"
        className="absolute inset-0 w-full h-full"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={active ? { opacity: 1, scale: 1 } : { opacity: 0.4, scale: 0.95 }}
        transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <defs>
          <linearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <motion.path
          d="M 100 20 L 170 50 L 170 110 Q 170 160 100 185 Q 30 160 30 110 L 30 50 Z"
          fill="none"
          stroke="url(#shieldGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={active ? { pathLength: 1 } : { pathLength: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
        />
        <motion.path
          d="M 70 100 L 92 122 L 135 78"
          fill="none"
          stroke="#10b981"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={active ? { pathLength: 1 } : { pathLength: 0 }}
          transition={{ duration: 0.6, delay: 0.9, ease: "easeOut" }}
          style={{ filter: "drop-shadow(0 0 8px rgba(16,185,129,0.6))" }}
        />
      </motion.svg>

      {/* Floating bank verification badge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ delay: 1.4, duration: 0.5 }}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-muted border border-border backdrop-blur-md flex items-center gap-2 shadow-xl"
      >
        <Check className="w-4 h-4 text-aurora-emerald" />
        <span className="text-xs text-foreground">Transit 004 · TD verified</span>
      </motion.div>
    </div>
  )
}

function FeatureCheck({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3 text-foreground/85">
      <div className="w-5 h-5 mt-0.5 rounded-full bg-aurora-emerald/20 border border-aurora-emerald/40 flex items-center justify-center shrink-0">
        <Check className="w-3 h-3 text-aurora-emerald" />
      </div>
      <span className="text-sm leading-relaxed">{text}</span>
    </li>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Scene 3 — Pulse (Karma + Escrow)
// ════════════════════════════════════════════════════════════════════════
function ScenePulse() {
  return (
    <section className="relative h-[180vh]">
      <div className="sticky top-0 h-screen flex items-center px-6">
        <div className="max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-12 items-center">
          <KarmaCard />
          <EscrowCard />
        </div>
      </div>
    </section>
  )
}

function KarmaCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ amount: 0.4 }}
      transition={{ duration: 0.7 }}
      className="relative rounded-3xl border border-border bg-muted/40 backdrop-blur-md p-8 overflow-hidden"
    >
      <div className="absolute -top-20 -right-20 w-60 h-60 bg-amber-500/20 rounded-full blur-3xl" />

      <div className="relative">
        <div className="flex items-center gap-3 mb-6">
          <motion.div
            animate={{ scale: [1, 1.1, 1], rotate: [0, 4, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-orange-500/40"
          >
            <Flame className="w-7 h-7 text-white" />
          </motion.div>
          <div>
            <span className="text-xs uppercase tracking-wider text-amber-300/80 font-semibold">Financial Karma</span>
            <h3 className="text-2xl font-bold text-foreground">Get rewarded for discipline.</h3>
          </div>
        </div>

        <p className="text-foreground/80 leading-relaxed mb-6">
          Every day you stay under your Safe-to-Spend, you earn points. Hit a 7 day streak?
          That&apos;s a bonus 50. Plaid verified only.
        </p>

        <div className="space-y-2.5">
          <KarmaRow icon="✨" label="Daily under-budget" pts="+10" />
          <KarmaRow icon="🔥" label="7-day streak" pts="+50" />
          <KarmaRow icon="🎯" label="Goal milestone" pts="+100" />
          <KarmaRow icon="🛡️" label="Rainy-day saved" pts="+20" />
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          Real world gift card redemptions coming after beta.
        </p>
      </div>
    </motion.div>
  )
}

function KarmaRow({ icon, label, pts }: { icon: string; label: string; pts: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-muted/60 border border-white/[0.06]">
      <div className="flex items-center gap-3 text-sm text-foreground/90">
        <span>{icon}</span>
        {label}
      </div>
      <span className="text-amber-300 font-mono font-bold text-sm">{pts}</span>
    </div>
  )
}

function EscrowCard() {
  // Daily limit auto-cycles to show how the bill protection works
  const [t, setT] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setT((p) => (p + 1) % 100), 50)
    return () => clearInterval(id)
  }, [])

  // 0–100 cycle: simulate days passing toward rent due
  const daysUntilRent = Math.round(7 - (t / 100) * 7)
  const escrowed = Math.min(1, t / 100) * 1500
  const dailyLimit = 80 - (escrowed / 30) // approx, illustrative
  const limitPct = Math.max(20, (dailyLimit / 80) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ amount: 0.4 }}
      transition={{ duration: 0.7, delay: 0.15 }}
      className="relative rounded-3xl border border-border bg-muted/40 backdrop-blur-md p-8 overflow-hidden"
    >
      <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-aurora-violet/20 rounded-full blur-3xl" />

      <div className="relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-aurora-violet to-aurora-teal flex items-center justify-center shadow-xl shadow-aurora-violet/40">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider text-violet-300/80 font-semibold">Big Bill Escrow</span>
            <h3 className="text-2xl font-bold text-foreground">Rent? Already protected.</h3>
          </div>
        </div>

        <p className="text-foreground/80 leading-relaxed mb-6">
          Aurora escrows fixed bills before they hit. Your daily limit shrinks
          slightly as the due date approaches so you never accidentally spend
          rent money on takeout.
        </p>

        {/* Live demo */}
        <div className="rounded-2xl bg-foreground/[0.04] border border-border p-5 space-y-4">
          <div className="flex justify-between text-xs text-foreground/80">
            <span>Rent due in <span className="text-foreground font-semibold">{daysUntilRent}d</span></span>
            <span>${Math.round(escrowed)} escrowed</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-foreground/80 text-xs">Daily Safe-to-Spend</span>
              <span className="text-foreground font-bold text-lg">${Math.round(dailyLimit)}</span>
            </div>
            <div className="relative h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-aurora-emerald via-aurora-teal to-aurora-violet"
                animate={{ width: `${limitPct}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
          </div>

          <div className="text-xs text-aurora-emerald flex items-center gap-1.5">
            <Lock className="w-3 h-3" />
            $1,500 of your rent is locked, untouchable.
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Scene 4 — Cleo-style auto-typing chat
// ════════════════════════════════════════════════════════════════════════
const CHAT_SCRIPT = [
  { role: "user" as const, text: "Can I afford this $70 dinner?" },
  {
    role: "aurora" as const,
    text:
      "Your Safe-to-Spend is **$120** today, and I've already escrowed your rent. Go for it — you've got a 5-day streak! 🔥",
  },
  { role: "user" as const, text: "What if I push it to $90?" },
  {
    role: "aurora" as const,
    text:
      "Still safe. You'd land at **$30 left** for the day. Just no Uber home — water it 😉",
  },
]

function SceneChat() {
  const ref = useRef<HTMLDivElement | null>(null)
  const inView = useInView(ref, { amount: 0.4, once: false })

  return (
    <section ref={ref} id="chat" className="relative h-[150vh]">
      <div className="sticky top-0 h-screen flex items-center px-6">
        <div className="max-w-6xl mx-auto w-full grid lg:grid-cols-[1fr_1.1fr] gap-16 items-center">
          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ amount: 0.4 }}
            transition={{ duration: 0.7 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-aurora-teal/30 bg-aurora-teal/[0.08] text-aurora-teal text-xs font-medium mb-6">
              <MessageSquare className="w-3 h-3" />
              The Coach
            </span>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.05] tracking-tight"
              style={{ textShadow: "var(--heading-shadow)" }}>
              Talk to it like a friend who&apos;s really good with money.
            </h2>
            <p className="text-lg text-foreground/80 mt-6 max-w-xl leading-relaxed">
              Aurora mirrors how you talk. Drop a question and get a real answer,
              no jargon, no shame, no &quot;please review your spending habits&quot; emails.
            </p>
          </motion.div>

          <ChatDemo active={inView} />
        </div>
      </div>
    </section>
  )
}

function ChatDemo({ active }: { active: boolean }) {
  const [messages, setMessages] = useState<{ role: "user" | "aurora"; text: string; complete: boolean }[]>([])
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    if (!active) {
      setMessages([])
      setTyping(false)
      return
    }
    let cancelled = false
    const run = async () => {
      for (let i = 0; i < CHAT_SCRIPT.length; i++) {
        if (cancelled) return
        const m = CHAT_SCRIPT[i]
        if (m.role === "aurora") {
          setTyping(true)
          await wait(900)
          if (cancelled) return
          setTyping(false)
        }
        // User messages appear instantly; Aurora messages stream in
        if (m.role === "user") {
          setMessages((prev) => [...prev, { ...m, complete: true }])
          await wait(700)
        } else {
          setMessages((prev) => [...prev, { ...m, complete: false, text: "" }])
          for (let c = 1; c <= m.text.length; c++) {
            if (cancelled) return
            await wait(18 + Math.random() * 14)
            setMessages((prev) => {
              const copy = [...prev]
              copy[copy.length - 1] = { ...copy[copy.length - 1], text: m.text.slice(0, c) }
              return copy
            })
          }
          setMessages((prev) => {
            const copy = [...prev]
            copy[copy.length - 1] = { ...copy[copy.length - 1], complete: true }
            return copy
          })
          await wait(900)
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [active])

  return (
    <motion.div
      initial={{ opacity: 0, x: 30, scale: 0.96 }}
      whileInView={{ opacity: 1, x: 0, scale: 1 }}
      viewport={{ amount: 0.4 }}
      transition={{ duration: 0.7 }}
      className="relative w-full max-w-md mx-auto rounded-3xl border border-border bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-xl overflow-hidden shadow-2xl"
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-aurora-emerald via-aurora-teal to-aurora-violet" />
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-aurora-emerald via-aurora-teal to-aurora-violet flex items-center justify-center shadow-lg shadow-aurora-teal/30">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-foreground text-sm font-semibold">Aurora</p>
          <p className="text-[11px] text-aurora-emerald flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-aurora-emerald animate-pulse" />
            Online
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="px-5 py-5 space-y-3 min-h-[380px]">
        <AnimatePresence>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-gradient-to-br from-aurora-emerald/30 to-aurora-teal/30 border border-aurora-emerald/30 text-foreground rounded-br-sm"
                    : "bg-muted border border-border text-foreground rounded-bl-sm"
                }`}
                dangerouslySetInnerHTML={{
                  __html: m.text.replace(
                    /\*\*(.+?)\*\*/g,
                    '<strong class="text-aurora-emerald font-semibold">$1</strong>'
                  ),
                }}
              />
            </motion.div>
          ))}
          {typing && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex justify-start"
            >
              <div className="bg-muted border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                    className="w-1.5 h-1.5 rounded-full bg-aurora-teal"
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Faux input */}
      <div className="px-5 pb-5">
        <div className="flex items-center gap-2 rounded-full bg-muted/60 border border-border px-4 py-2.5">
          <span className="text-muted-foreground/70 text-sm flex-1">Ask Aurora anything...</span>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-aurora-emerald to-aurora-teal flex items-center justify-center">
            <Send className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ════════════════════════════════════════════════════════════════════════
// Scene 5 — Arctic Dawn CTA
// ════════════════════════════════════════════════════════════════════════
function SceneDawn() {
  return (
    <section id="cta" className="relative h-[100vh]">
      <div className="sticky top-0 h-screen flex items-center justify-center px-6">
        <div className="max-w-3xl text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.4 }}
            transition={{ duration: 0.8 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/40 bg-amber-100/70 dark:bg-amber-500/[0.08] text-amber-700 dark:text-amber-300 text-xs font-medium mb-6 shadow-sm">
              <Sparkles className="w-3 h-3" />
              The closed beta opens this season
            </span>
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground leading-[1.05] tracking-tight"
              style={{ textShadow: "var(--heading-shadow)" }}>
              Claim 1 of <span className="bg-gradient-to-r from-amber-500 via-aurora-emerald to-aurora-violet bg-clip-text text-transparent">50 spots</span>.
            </h2>
            <p className="text-lg text-foreground/80 mt-6 max-w-xl mx-auto leading-relaxed">
              Drop your email below we&apos;ll review and email you when your spot
              opens. No spam, no marketing list rentals.
            </p>

            <div className="mt-10 max-w-xl mx-auto">
              <EarlyAccessForm source="landing-dawn" />
            </div>

            <p className="text-xs text-muted-foreground mt-8">
              Already approved?{" "}
              <Link href="/sign-in" className="text-aurora-teal hover:underline font-medium">
                Sign in →
              </Link>
            </p>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative bg-background/80 backdrop-blur-xl border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-aurora-emerald via-aurora-teal to-aurora-violet rounded-md" />
            <span className="font-semibold text-foreground">Aurora</span>
            <span className="text-muted-foreground/70">— money with a bodyguard.</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/sign-in" className="hover:text-foreground transition-colors">Sign in</Link>
            <a href="mailto:hello@aurora.app" className="hover:text-foreground transition-colors">Contact</a>
            <span className="text-muted-foreground/70">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </section>
  )
}
