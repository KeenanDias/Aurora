"use client"

import { motion, AnimatePresence } from "framer-motion"

type SecurityStatus = "uploading" | "encrypting" | "secure"

const STATUS_TEXT: Record<SecurityStatus, string> = {
  uploading: "Uploading statement...",
  encrypting: "Securing with AES-256...",
  secure: "Data Locked",
}

export function SecurityLoader({
  status,
  fileName,
}: {
  status: SecurityStatus
  fileName?: string
}) {
  return (
    <div className="relative flex flex-col items-center justify-center gap-5 py-8 px-6">
      {/* Glassmorphism card */}
      <div className="absolute inset-0 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] overflow-hidden">
        {/* Scanning light beam during encrypting phase */}
        <AnimatePresence>
          {status === "encrypting" && (
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-transparent via-emerald-400/10 to-transparent skew-x-[-20deg]"
            />
          )}
        </AnimatePresence>
      </div>

      {/* Icon area */}
      <div className="relative z-10">
        <AnimatePresence mode="wait">
          {status === "uploading" && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="relative w-16 h-16"
            >
              {/* Progress ring */}
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="3"
                />
                <motion.circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="url(#uploadGradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 28}
                  initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                />
                <defs>
                  <linearGradient id="uploadGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
              {/* File icon in center */}
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-6 h-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
            </motion.div>
          )}

          {status === "encrypting" && (
            <motion.div
              key="encrypting"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="relative w-16 h-16 flex items-center justify-center"
            >
              {/* Padlock SVG with animated shackle */}
              <svg width="48" height="56" viewBox="0 0 48 56" fill="none">
                {/* Lock body */}
                <rect x="6" y="28" width="36" height="24" rx="4" fill="url(#lockBodyGrad)" />
                {/* Keyhole */}
                <circle cx="24" cy="38" r="3" fill="#0b1120" />
                <rect x="22.5" y="38" width="3" height="6" rx="1.5" fill="#0b1120" />
                {/* Shackle (animated) */}
                <motion.path
                  d="M14 28V18C14 12.477 18.477 8 24 8C29.523 8 34 12.477 34 18V28"
                  stroke="url(#shackleGrad)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                  initial={{ y: -8, opacity: 0.6 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 15,
                    mass: 1.2,
                    delay: 0.3,
                  }}
                />
                <defs>
                  <linearGradient id="lockBodyGrad" x1="6" y1="28" x2="42" y2="52">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                  <linearGradient id="shackleGrad" x1="14" y1="8" x2="34" y2="28">
                    <stop offset="0%" stopColor="#a5b4fc" />
                    <stop offset="100%" stopColor="#818cf8" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
          )}

          {status === "secure" && (
            <motion.div
              key="secure"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="relative w-16 h-16 flex items-center justify-center"
            >
              {/* Emerald security pulse */}
              <motion.div
                className="absolute inset-0 rounded-full bg-emerald-500/20"
                animate={{
                  scale: [1, 1.4, 1],
                  opacity: [0.3, 0, 0.3],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute inset-2 rounded-full bg-emerald-500/10"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.4, 0.1, 0.4],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              />
              {/* Locked padlock with checkmark */}
              <svg width="48" height="56" viewBox="0 0 48 56" fill="none">
                <rect x="6" y="28" width="36" height="24" rx="4" fill="url(#secureBodyGrad)" />
                <path
                  d="M14 28V18C14 12.477 18.477 8 24 8C29.523 8 34 12.477 34 18V28"
                  stroke="url(#secureShackleGrad)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* Checkmark */}
                <motion.path
                  d="M17 40L22 45L31 35"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
                />
                <defs>
                  <linearGradient id="secureBodyGrad" x1="6" y1="28" x2="42" y2="52">
                    <stop offset="0%" stopColor="#059669" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                  <linearGradient id="secureShackleGrad" x1="14" y1="8" x2="34" y2="28">
                    <stop offset="0%" stopColor="#6ee7b7" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status text */}
      <div className="relative z-10 text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={status}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="text-sm font-medium text-white/80"
          >
            {STATUS_TEXT[status]}
          </motion.p>
        </AnimatePresence>
        {fileName && (
          <p className="text-xs text-white/30 mt-1 truncate max-w-[220px]">
            {fileName}
          </p>
        )}
      </div>
    </div>
  )
}
