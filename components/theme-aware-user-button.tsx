"use client"

import { UserButton } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

/**
 * Clerk's default popup uses light text on dark surfaces, which renders as
 * white-on-white in our light theme. We pass `baseTheme: dark` only when the
 * resolved theme is dark, and override the popover surface + text colors to
 * stay in sync with our tokens either way.
 */
export function ThemeAwareUserButton() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Avoid hydration drift — render the avatar box only after we know the theme.
  if (!mounted) {
    return <div className="w-9 h-9 rounded-full bg-muted" aria-hidden />
  }

  const isDark = resolvedTheme === "dark"

  return (
    <UserButton
      appearance={{
        baseTheme: isDark ? dark : undefined,
        variables: isDark
          ? {
              colorBackground: "#0b1120",
              colorText: "#f8fafc",
              colorTextSecondary: "#94a3b8",
              colorPrimary: "#10b981",
            }
          : {
              colorBackground: "#ffffff",
              colorText: "#0f172a",
              colorTextSecondary: "#475569",
              colorPrimary: "#10b981",
            },
        elements: {
          avatarBox: "w-9 h-9",

          // ── Avatar dropdown ─────────────────────────────────────────
          userButtonPopoverCard: isDark
            ? "bg-[#0b1120] border border-white/10 shadow-2xl"
            : "bg-white border border-slate-200 shadow-2xl",
          userButtonPopoverActionButton: isDark
            ? "text-slate-100 hover:bg-white/[0.06]"
            : "text-slate-900 hover:bg-slate-100",
          userButtonPopoverActionButtonText: isDark ? "text-slate-100" : "text-slate-900",
          userButtonPopoverActionButtonIcon: isDark ? "text-slate-300" : "text-slate-600",
          userButtonPopoverFooter: isDark
            ? "bg-[#0b1120] border-t border-white/10"
            : "bg-slate-50 border-t border-slate-200",
          userPreviewMainIdentifier: isDark ? "text-slate-100" : "text-slate-900",
          userPreviewSecondaryIdentifier: isDark ? "text-slate-400" : "text-slate-600",

          // ── "Manage account" modal ──────────────────────────────────
          modalBackdrop: isDark ? "bg-black/70 backdrop-blur-sm" : "bg-slate-900/40 backdrop-blur-sm",
          modalContent: isDark ? "bg-[#0b1120]" : "bg-white",
          card: isDark ? "bg-[#0b1120] border border-white/10" : "bg-white border border-slate-200",
          cardBox: isDark ? "bg-[#0b1120] border border-white/10 shadow-2xl" : "bg-white border border-slate-200 shadow-2xl",

          // Sidebar nav inside the modal
          navbar: isDark ? "bg-[#0b1120] border-r border-white/10" : "bg-slate-50 border-r border-slate-200",
          navbarMobileMenuRow: isDark ? "bg-[#0b1120]" : "bg-white",
          navbarButton: isDark ? "text-slate-300 hover:bg-white/[0.06] hover:text-slate-100" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
          navbarButton__active: isDark ? "bg-white/[0.08] text-slate-100" : "bg-slate-200 text-slate-900",

          // Header / page titles
          headerTitle: isDark ? "text-slate-100" : "text-slate-900",
          headerSubtitle: isDark ? "text-slate-400" : "text-slate-600",
          pageScrollBox: isDark ? "bg-[#0b1120]" : "bg-white",

          // Profile sections + rows
          profileSection: isDark ? "border-b border-white/10" : "border-b border-slate-200",
          profileSectionTitle: isDark ? "text-slate-100" : "text-slate-900",
          profileSectionTitleText: isDark ? "text-slate-100" : "text-slate-900",
          profileSectionContent: isDark ? "text-slate-200" : "text-slate-800",
          profileSectionPrimaryButton: isDark ? "text-aurora-emerald hover:bg-white/[0.06]" : "text-emerald-600 hover:bg-emerald-50",
          accordionTriggerButton: isDark ? "text-slate-200 hover:bg-white/[0.06]" : "text-slate-800 hover:bg-slate-100",

          // Generic body text + form labels
          formFieldLabel: isDark ? "text-slate-200" : "text-slate-800",
          formFieldInput: isDark
            ? "bg-white/[0.04] border border-white/10 text-slate-100 placeholder:text-slate-500"
            : "bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400",
          formFieldInputShowPasswordButton: isDark ? "text-slate-300" : "text-slate-600",
          formFieldHintText: isDark ? "text-slate-400" : "text-slate-600",
          formFieldErrorText: "text-red-400",
          formButtonPrimary: "bg-gradient-to-r from-aurora-emerald to-aurora-teal hover:opacity-90 text-white border-0",
          formButtonReset: isDark ? "text-slate-300 hover:bg-white/[0.06]" : "text-slate-700 hover:bg-slate-100",

          // Bordered "badge" rows (email/phone/connected accounts)
          badge: isDark ? "bg-white/[0.06] text-slate-200 border border-white/10" : "bg-slate-100 text-slate-800 border border-slate-200",
          identityPreview: isDark ? "bg-white/[0.04] border border-white/10" : "bg-slate-50 border border-slate-200",
          identityPreviewText: isDark ? "text-slate-200" : "text-slate-800",
          identityPreviewEditButton: isDark ? "text-aurora-emerald hover:text-aurora-teal" : "text-emerald-600 hover:text-emerald-700",

          // Modal close button
          modalCloseButton: isDark ? "text-slate-300 hover:bg-white/[0.06]" : "text-slate-700 hover:bg-slate-100",

          // Footer
          footer: isDark ? "bg-[#0b1120] border-t border-white/10" : "bg-slate-50 border-t border-slate-200",
          footerActionText: isDark ? "text-slate-400" : "text-slate-600",
          footerActionLink: isDark ? "text-aurora-emerald hover:text-aurora-teal" : "text-emerald-600 hover:text-emerald-700",
        },
      }}
    />
  )
}
