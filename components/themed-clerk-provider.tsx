"use client"

import { ClerkProvider } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { useTheme } from "next-themes"
import { useEffect, useState, type ReactNode } from "react"

/**
 * Wraps Clerk so its baseTheme tracks next-themes. Without this, the modal
 * portal (which renders at the provider level, above our per-component
 * appearance overrides) stays dark even after the app is in light mode.
 */
export function ThemedClerkProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Until the theme resolves we use the dark theme — matches our default.
  const isDark = !mounted || resolvedTheme === "dark"

  return (
    <ClerkProvider
      appearance={{
        baseTheme: isDark ? dark : undefined,
        variables: isDark
          ? {
              colorPrimary: "#10b981",
              colorBackground: "#020617",
              colorInputBackground: "#111827",
              colorInputText: "#e2e8f0",
            }
          : {
              colorPrimary: "#10b981",
              colorBackground: "#ffffff",
              colorText: "#0f172a",
              colorTextSecondary: "#475569",
              colorInputBackground: "#ffffff",
              colorInputText: "#0f172a",
            },
      }}
    >
      {children}
    </ClerkProvider>
  )
}
