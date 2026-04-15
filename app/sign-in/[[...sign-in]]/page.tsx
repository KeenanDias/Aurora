"use client"

import { SignIn } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { useEffect, useRef } from "react"

function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      opacity: Math.random(),
      speed: Math.random() * 0.005 + 0.002,
      phase: Math.random() * Math.PI * 2,
    }))

    let frame: number
    const draw = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const s of stars) {
        const flicker = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase)
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${flicker * 0.8})`
        ctx.fill()
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060b18] relative overflow-hidden">
      {/* Stars */}
      <StarField />

      {/* Aurora layers */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-1/3 -left-1/4 w-[150%] h-[80%]"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 25% 20%, rgba(16,185,129,0.25) 0%, transparent 60%)",
            animation: "aurora-shift 12s ease-in-out infinite",
          }}
        />
        <div
          className="absolute -top-1/4 -right-1/4 w-[120%] h-[70%]"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 70% 15%, rgba(6,182,212,0.2) 0%, transparent 55%)",
            animation: "aurora-shift-2 15s ease-in-out infinite",
          }}
        />
        <div
          className="absolute top-0 left-1/4 w-[80%] h-[60%]"
          style={{
            background:
              "radial-gradient(ellipse 70% 45% at 50% 10%, rgba(139,92,246,0.15) 0%, transparent 50%)",
            animation: "aurora-shift-3 18s ease-in-out infinite",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/30 mb-5">
            <span className="text-white font-bold text-2xl">A</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">
            Welcome back
          </h1>
          <p className="text-white/50 text-sm">Sign in to your Aurora account</p>
        </div>
        <SignIn
          appearance={{
            baseTheme: dark,
            variables: {
              colorPrimary: "#14b8a6",
              colorBackground: "rgba(11, 17, 32, 0.8)",
              colorInputBackground: "rgba(17, 24, 39, 0.9)",
              colorInputText: "#ffffff",
              colorText: "#ffffff",
              colorTextSecondary: "#94a3b8",
              colorNeutral: "#ffffff",
              colorTextOnPrimaryBackground: "#ffffff",
              borderRadius: "0.75rem",
            },
            elements: {
              card: {
                background: "rgba(11, 17, 32, 0.6)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              },
              headerTitle: {
                color: "#ffffff",
                fontWeight: "700",
              },
              headerSubtitle: {
                color: "rgba(255, 255, 255, 0.6)",
              },
              socialButtonsBlockButton: {
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#ffffff",
              },
              socialButtonsBlockButtonText: {
                color: "#ffffff",
                fontWeight: "500",
              },
              dividerLine: {
                background: "rgba(255, 255, 255, 0.15)",
              },
              dividerText: {
                color: "rgba(255, 255, 255, 0.4)",
              },
              formFieldLabel: {
                color: "rgba(255, 255, 255, 0.85)",
                fontWeight: "500",
              },
              formFieldInput: {
                background: "rgba(17, 24, 39, 0.8)",
                borderColor: "rgba(255, 255, 255, 0.15)",
                color: "#ffffff",
              },
              formButtonPrimary: {
                background: "linear-gradient(135deg, #10b981, #14b8a6, #06b6d4)",
                fontWeight: "600",
                boxShadow: "0 4px 15px rgba(20, 184, 166, 0.4)",
              },
              footerActionLink: {
                color: "#2dd4bf",
                fontWeight: "600",
              },
              footerActionText: {
                color: "rgba(255, 255, 255, 0.5)",
              },
              formFieldAction: {
                color: "#2dd4bf",
              },
              identityPreviewText: {
                color: "#ffffff",
              },
              identityPreviewEditButton: {
                color: "#2dd4bf",
              },
              footerAction: {
                color: "rgba(255, 255, 255, 0.5)",
              },
              footer: {
                color: "rgba(255, 255, 255, 0.4)",
              },
            },
          }}
        />
      </div>
    </div>
  )
}
