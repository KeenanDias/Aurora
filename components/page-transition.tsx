"use client"

import { motion } from "framer-motion"

/**
 * Wrap page content to fade + slide up on mount. Used between routes
 * (e.g. Dashboard ↔ Vault) for a premium layout transition feel.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}
