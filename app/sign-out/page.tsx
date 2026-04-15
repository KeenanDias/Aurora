"use client"

import { useClerk } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function SignOutPage() {
  const { signOut } = useClerk()
  const router = useRouter()

  useEffect(() => {
    signOut().then(() => router.push("/"))
  }, [signOut, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b1120]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/25">
          <span className="text-white font-bold text-xl">A</span>
        </div>
        <p className="text-white/60 text-sm">Signing you out...</p>
      </div>
    </div>
  )
}
