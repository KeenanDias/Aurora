"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser } from "@clerk/nextjs"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles } from "lucide-react"
import { AuroraSpinner } from "@/components/aurora-spinner"

/**
 * Mounted at the top of the landing page. If the visitor is already signed
 * in, paints a brief "Welcome back" overlay and routes them to /dashboard.
 *
 * The dashboard's own server-side guard handles the `!onboarded` case (sends
 * them to /onboarding), so we don't need to duplicate that check here.
 *
 * If the user isn't signed in, this component renders nothing.
 */
export function ReturningUserRedirect() {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const router = useRouter()
  const [showOverlay, setShowOverlay] = useState(false)

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return

    // Only auto-redirect when the user arrived at "/" from outside the app
    // (direct URL, sign-in flow, external link). If they clicked the Aurora
    // logo from /dashboard or anywhere else inside the app, respect that —
    // they wanted to see the landing page.
    if (typeof window !== "undefined") {
      const ref = document.referrer
      if (ref) {
        try {
          const refUrl = new URL(ref)
          if (refUrl.origin === window.location.origin) {
            // Came from somewhere in our own app — let them stay.
            return
          }
        } catch {
          // malformed referrer — fall through and redirect
        }
      }
    }

    setShowOverlay(true)
    // Pre-warm the dashboard route so the push feels instant.
    router.prefetch("/dashboard")
    // Brief beat so the welcome message reads, then go.
    const t = setTimeout(() => router.replace("/dashboard"), 1100)
    return () => clearTimeout(t)
  }, [isLoaded, isSignedIn, router])

  return (
    <AnimatePresence>
      {showOverlay && (
        <motion.div
          key="returning-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
        >
          {/* Soft aurora wash so the overlay doesn't read as a flat loading screen */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/3 -translate-x-1/2 w-[60vw] h-[40vh] bg-gradient-to-br from-aurora-emerald/20 via-aurora-teal/15 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/3 translate-x-1/2 w-[50vw] h-[35vh] bg-gradient-to-br from-aurora-violet/15 via-aurora-teal/10 to-transparent rounded-full blur-3xl" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.1, type: "spring", damping: 22, stiffness: 180 }}
            className="relative z-10 flex flex-col items-center text-center px-6"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-aurora-emerald via-aurora-teal to-aurora-violet flex items-center justify-center shadow-xl shadow-aurora-teal/30 mb-5">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 tracking-tight">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Pulling up your dashboard…
            </p>
            <div className="w-48">
              <AuroraSpinner />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
