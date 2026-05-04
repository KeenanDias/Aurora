"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Upload,
  FileText,
  Link2,
  Shield,
  Eye,
  Clock,
  X,
  ChevronRight,
  Trash2,
  AlertTriangle,
} from "lucide-react"
import { SecurityLoader } from "@/components/security-loader"

type VaultUpload = {
  id: string
  filename: string
  period_start: string
  period_end: string
  total_income: number
  total_spending: number
  fixed_bills: number
  transaction_count: number
  source: string
  last_accessed: string
  created_at: string
}

type UploadDetail = VaultUpload & {
  transactions: {
    date: string
    description: string
    amount: number
    category: string
  }[]
}

export function VaultContent() {
  const [uploads, setUploads] = useState<VaultUpload[]>([])
  const [plaidConnected, setPlaidConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedUpload, setSelectedUpload] = useState<UploadDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<"uploading" | "encrypting" | "secure" | null>(null)
  const [uploadFileName, setUploadFileName] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadMismatch, setUploadMismatch] = useState<{ failures: string[]; warnings: string[] } | null>(null)

  const fetchVault = useCallback(async () => {
    try {
      const res = await fetch("/api/vault")
      if (res.ok) {
        const data = await res.json()
        setUploads(data.uploads)
        setPlaidConnected(data.plaidConnected)
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVault()
  }, [fetchVault])

  // Listen for cross-talk events from chatbot uploads
  useEffect(() => {
    const handler = () => fetchVault()
    window.addEventListener("aurora-vault-updated", handler)
    return () => window.removeEventListener("aurora-vault-updated", handler)
  }, [fetchVault])

  const handleViewDetails = async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/vault/${id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedUpload(data)
        // Update last_accessed in local state
        setUploads((prev) =>
          prev.map((u) =>
            u.id === id ? { ...u, last_accessed: new Date().toISOString() } : u
          )
        )
      }
    } catch {
      // silent fail
    } finally {
      setDetailLoading(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    if (file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) return

    setUploadFileName(file.name)
    setUploadStatus("uploading")

    try {
      const formData = new FormData()
      formData.append("file", file)

      await new Promise((r) => setTimeout(r, 800))
      setUploadStatus("encrypting")

      const res = await fetch("/api/vault/upload", {
        method: "POST",
        body: formData,
      })

      await new Promise((r) => setTimeout(r, 1500))

      if (res.status === 409) {
        const data = await res.json()
        setUploadMismatch({ failures: data.failures ?? [], warnings: data.warnings ?? [] })
        setUploadStatus(null)
        setUploadFileName("")
        return
      }

      if (!res.ok) throw new Error("Upload failed")

      setUploadStatus("secure")
      await new Promise((r) => setTimeout(r, 1200))

      // Refresh vault list
      fetchVault()
      window.dispatchEvent(new Event("aurora-vault-updated"))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const refresh = (window as any).__refreshDashboardMetrics
      if (typeof refresh === "function") refresh()
    } catch {
      // silent fail
    } finally {
      setUploadStatus(null)
      setUploadFileName("")
    }
  }

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this statement from the vault? This can't be undone.")) return

    setDeletingId(id)
    try {
      const res = await fetch(`/api/vault/${id}`, { method: "DELETE" })
      if (res.ok) {
        setUploads((prev) => prev.filter((u) => u.id !== id))
        if (selectedUpload?.id === id) setSelectedUpload(null)
        window.dispatchEvent(new Event("aurora-vault-updated"))
      }
    } catch {
      // silent fail
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return "Just now"
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileUpload(file)
          e.target.value = ""
        }}
      />

      {/* Upload animation overlay */}
      <AnimatePresence>
        {uploadStatus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#0b1120]/80 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="w-80">
              <SecurityLoader status={uploadStatus} fileName={uploadFileName} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Verification mismatch warning */}
      {uploadMismatch && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1">
              <p className="text-sm font-medium text-white">
                This statement doesn&apos;t seem to match your linked bank account
              </p>
              {uploadMismatch.failures.map((f, i) => (
                <p key={i} className="text-xs text-muted-foreground">• {f}</p>
              ))}
              <p className="text-xs text-muted-foreground">
                If this is a different account, you can dismiss this warning.
              </p>
              <button
                onClick={() => setUploadMismatch(null)}
                className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Sources Overview */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {/* Plaid connection card */}
        <div
          className={`rounded-xl border p-5 ${
            plaidConnected
              ? "border-emerald-500/20 bg-emerald-500/[0.04]"
              : "border-border/60 bg-muted/40"
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                plaidConnected
                  ? "bg-emerald-500/20"
                  : "bg-muted"
              }`}
            >
              <Link2
                className={`w-5 h-5 ${
                  plaidConnected ? "text-emerald-400" : "text-muted-foreground/70"
                }`}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Plaid Connection</p>
              <p className="text-xs text-muted-foreground">
                {plaidConnected ? "Live and syncing" : "Not connected"}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/70">
            {plaidConnected
              ? "Real-time transaction data feeds directly into your Safe-to-Spend."
              : "Connect your bank on the Dashboard to enable live data."}
          </p>
        </div>

        {/* Manual uploads card */}
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Manual Uploads</p>
              <p className="text-xs text-muted-foreground">
                {uploads.length} statement{uploads.length !== 1 ? "s" : ""} in vault
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/70">
            Encrypted with AES-256-GCM. Only Aurora reads your data.
          </p>
        </div>
      </div>

      {/* Upload button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={!!uploadStatus}
        className="w-full mb-8 py-4 rounded-xl border-2 border-dashed border-border hover:border-teal-500/30 bg-muted/40 hover:bg-teal-500/[0.03] transition-all flex items-center justify-center gap-3 group disabled:opacity-50"
      >
        <Upload className="w-5 h-5 text-muted-foreground/70 group-hover:text-teal-400 transition-colors" />
        <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground/80 transition-colors">
          Upload New Statement
        </span>
        <span className="text-xs text-white/20">PDF only, max 10MB</span>
      </button>

      {/* Security Ledger */}
      {uploads.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-muted/40 p-4 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-emerald-400" />
            <p className="text-xs font-medium text-muted-foreground">Security Ledger</p>
          </div>
          <div className="space-y-2">
            {uploads.slice(0, 5).map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span className="truncate max-w-[180px]">{u.filename}</span>
                </div>
                <span className="text-white/25">
                  Last accessed: {timeAgo(u.last_accessed)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-white/20 mt-3">
            Aurora last looked at your encrypted data to update your Safe-to-Spend limit.
          </p>
        </div>
      )}

      {/* Uploads Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground/70 mt-3">Loading vault...</p>
        </div>
      ) : uploads.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground mb-2">No statements uploaded yet</p>
          <p className="text-xs text-white/25">
            Upload a bank statement PDF or drop one into the Aurora chat.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_120px_80px_80px_50px] gap-4 px-5 py-3 border-b border-border/60 bg-muted/40">
            <span className="text-xs font-medium text-muted-foreground">File</span>
            <span className="text-xs font-medium text-muted-foreground">Period</span>
            <span className="text-xs font-medium text-muted-foreground">Source</span>
            <span className="text-xs font-medium text-muted-foreground text-right">Spending</span>
            <span className="text-xs font-medium text-muted-foreground text-center">Details</span>
            <span className="text-xs font-medium text-muted-foreground text-center"></span>
          </div>
          {uploads.map((u) => (
            <div
              key={u.id}
              className="grid grid-cols-[1fr_120px_120px_80px_80px_50px] gap-4 px-5 py-3.5 border-b border-white/[0.04] hover:bg-muted/40 transition-colors items-center"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-violet-400 shrink-0" />
                <span className="text-sm text-foreground/80 truncate">{u.filename}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDate(u.period_start)}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full w-fit ${
                  u.source === "manual_upload"
                    ? "bg-violet-500/10 text-violet-400"
                    : "bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {u.source === "manual_upload" ? "Upload" : "Plaid"}
              </span>
              <span className="text-xs text-muted-foreground text-right">
                ${u.total_spending.toLocaleString()}
              </span>
              <div className="flex justify-center">
                <button
                  onClick={() => handleViewDetails(u.id)}
                  className="flex items-center gap-1 text-xs text-teal-400/70 hover:text-teal-400 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View
                </button>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => handleDelete(u.id)}
                  disabled={deletingId === u.id}
                  className="flex items-center justify-center w-7 h-7 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                >
                  {deletingId === u.id ? (
                    <div className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {(selectedUpload || detailLoading) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !detailLoading && setSelectedUpload(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[80vh] rounded-2xl border border-border bg-[#0b1120] overflow-hidden flex flex-col"
            >
              {detailLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin" />
                </div>
              ) : selectedUpload ? (
                <>
                  {/* Modal header */}
                  <div className="flex items-center justify-between p-5 border-b border-border/60">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {selectedUpload.filename}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(selectedUpload.period_start)} —{" "}
                        {formatDate(selectedUpload.period_end)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(selectedUpload.id)}
                        disabled={deletingId === selectedUpload.id}
                        className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                      <button
                        onClick={() => setSelectedUpload(null)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>

                  {/* Metrics summary */}
                  <div className="grid grid-cols-3 gap-4 p-5 border-b border-white/[0.04]">
                    <div>
                      <p className="text-xs text-muted-foreground">Income</p>
                      <p className="text-lg font-bold text-emerald-400">
                        ${selectedUpload.total_income.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Spending</p>
                      <p className="text-lg font-bold text-orange-400">
                        ${selectedUpload.total_spending.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fixed Bills</p>
                      <p className="text-lg font-bold text-violet-400">
                        ${selectedUpload.fixed_bills.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Transactions list */}
                  <div className="flex-1 overflow-y-auto p-5">
                    <p className="text-xs font-medium text-muted-foreground mb-3">
                      {selectedUpload.transactions.length} Transactions Extracted
                    </p>
                    <div className="space-y-1.5">
                      {selectedUpload.transactions.map((tx, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/[0.03]"
                        >
                          <ChevronRight className="w-3 h-3 text-white/20 shrink-0" />
                          <span className="text-xs text-muted-foreground/70 w-20 shrink-0">
                            {tx.date}
                          </span>
                          <span className="text-sm text-foreground/80 flex-1 truncate">
                            {tx.description}
                          </span>
                          <span
                            className={`text-sm font-medium ${
                              tx.amount < 0
                                ? "text-emerald-400"
                                : "text-foreground/80"
                            }`}
                          >
                            {tx.amount < 0 ? "+" : "-"}$
                            {Math.abs(tx.amount).toFixed(2)}
                          </span>
                          <span className="text-[10px] text-white/25 w-24 text-right truncate">
                            {tx.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
