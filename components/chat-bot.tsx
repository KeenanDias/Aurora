"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import { motion, AnimatePresence, useDragControls } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MessageSquare, Send, X, Sparkles, GripHorizontal } from "lucide-react"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
}

const NEW_USER_WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hey! I'm Aurora — your personal financial coach.\n\nI'm here to help you figure out your **Safe-to-Spend**, set goals, and make sure money stress doesn't run your life.\n\nLet's start simple — what's your name?",
}

const DEFAULT_SIZE = { width: 400, height: 560 }
const MIN_SIZE = { width: 320, height: 400 }
const MAX_SIZE = { width: 700, height: 800 }

export function ChatBot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [welcomeLoaded, setWelcomeLoaded] = useState(false)
  const [size, setSize] = useState(DEFAULT_SIZE)

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const openRef = useRef(open)
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null)
  const dragControls = useDragControls()

  useEffect(() => {
    openRef.current = open
  }, [open])

  // Fetch profile on mount
  useEffect(() => {
    async function loadWelcome() {
      try {
        const res = await fetch("/api/chat/profile")
        if (res.ok) {
          const data = await res.json()
          if (data.onboarded && data.name) {
            setMessages([
              {
                id: "welcome",
                role: "assistant",
                content: `Hey ${data.name}! Welcome back.\n\nAnything I can help with today? I can give you an update on your **${data.goal_description || "savings goal"}**, check your **daily Safe-to-Spend**, or just chat about money stuff.`,
              },
            ])
          } else {
            setMessages([NEW_USER_WELCOME])
          }
        } else {
          setMessages([NEW_USER_WELCOME])
        }
      } catch {
        setMessages([NEW_USER_WELCOME])
      }
      setWelcomeLoaded(true)
    }
    loadWelcome()
  }, [])

  // Auto-scroll: find the Radix scroll viewport and scroll it to bottom
  useEffect(() => {
    const el = scrollAreaRef.current
    if (!el) return
    const viewport = el.querySelector("[data-slot='scroll-area-viewport']") as HTMLElement | null
    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" })
      })
    }
  }, [messages, isLoading])

  // Reset window size and position every time it opens
  const [sessionKey, setSessionKey] = useState(0)
  useEffect(() => {
    if (open) {
      setSize(DEFAULT_SIZE)
      setSessionKey((k) => k + 1)
      setTimeout(() => inputRef.current?.focus(), 200)
      setUnreadCount(0)
    }
  }, [open])

  const addMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg])
    if (!openRef.current && msg.role === "assistant" && msg.id !== "welcome") {
      setUnreadCount((c) => c + 1)
    }
  }, [])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
    }

    const updatedMessages = [
      ...messages.filter((m) => m.id !== "welcome"),
      userMessage,
    ]
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to get response")

      if (data.profileUpdated) {
        window.dispatchEvent(new Event("aurora-profile-updated"))
      }

      addMessage({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
      })
    } catch {
      addMessage({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "Sorry, I'm having trouble connecting right now. Please try again in a moment!",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Resize from bottom-left corner
  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: size.width,
      startH: size.height,
    }

    const handleResizeMove = (ev: PointerEvent) => {
      if (!resizeRef.current) return
      const dx = resizeRef.current.startX - ev.clientX // left = bigger
      const dy = ev.clientY - resizeRef.current.startY // down = bigger
      setSize({
        width: Math.min(MAX_SIZE.width, Math.max(MIN_SIZE.width, resizeRef.current.startW + dx)),
        height: Math.min(MAX_SIZE.height, Math.max(MIN_SIZE.height, resizeRef.current.startH + dy)),
      })
    }

    const handleResizeEnd = () => {
      resizeRef.current = null
      window.removeEventListener("pointermove", handleResizeMove)
      window.removeEventListener("pointerup", handleResizeEnd)
    }

    window.addEventListener("pointermove", handleResizeMove)
    window.addEventListener("pointerup", handleResizeEnd)
  }

  // Double-click header to snap back
  const handleDoubleClick = () => {
    setSize(DEFAULT_SIZE)
  }

  return (
    <>
      {/* Trigger button */}
      <Button
        onClick={() => setOpen((o) => !o)}
        size="icon-lg"
        className="fixed bottom-6 right-6 z-50 rounded-full w-14 h-14 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 shadow-xl shadow-teal-500/30 border-0 transition-all hover:scale-105"
      >
        {open ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <>
            <MessageSquare className="w-6 h-6 text-white" />
            {isLoading && unreadCount === 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-400 border-2 border-[#0b1120]" />
              </span>
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-red-500 border-2 border-[#0b1120] text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </>
        )}
      </Button>

      {/* Floating chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            key={sessionKey}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragConstraints={{
              top: -(window?.innerHeight ? window.innerHeight - 88 - size.height : 0),
              left: -(window?.innerWidth ? window.innerWidth - 24 - size.width + 60 : 0),
              right: 0,
              bottom: 40,
            }}
            dragElastic={0}
            style={{
              width: size.width,
              height: size.height,
              position: "fixed",
              bottom: 88,
              right: 24,
              zIndex: 50,
            }}
            className="flex flex-col rounded-2xl border border-white/10 bg-[#0b1120] shadow-2xl shadow-black/40 overflow-hidden"
          >
            {/* Aurora gradient glow on top edge */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-400 via-teal-400 to-violet-500" />

            {/* Draggable header */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              onDoubleClick={handleDoubleClick}
              className="flex items-center justify-between p-3 px-4 border-b border-white/[0.06] cursor-grab active:cursor-grabbing select-none shrink-0 bg-gradient-to-r from-[#0b1120] via-[#0d1526] to-[#0b1120]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/25">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-tight">Aurora AI</p>
                  <p className="text-[11px] text-white/35">Your financial coach</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <GripHorizontal className="w-4 h-4 text-white/20 mr-1" />
                <button
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-hidden">
              <div className="p-4 space-y-5">
                {!welcomeLoaded ? (
                  <div className="flex gap-3">
                    <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
                      <AvatarFallback className="bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 text-white text-xs font-bold">
                        A
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 flex gap-1.5 items-center">
                      <span className="w-2 h-2 rounded-full bg-teal-400/60 animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 rounded-full bg-teal-400/60 animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 rounded-full bg-teal-400/60 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${
                        msg.role === "user" ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
                        <AvatarFallback
                          className={
                            msg.role === "assistant"
                              ? "bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 text-white text-xs font-bold"
                              : "bg-white/10 text-white/70 text-xs font-medium"
                          }
                        >
                          {msg.role === "assistant" ? "A" : "U"}
                        </AvatarFallback>
                      </Avatar>

                      <div
                        className={`max-w-[85%] w-full rounded-2xl px-4 py-3 text-sm ${
                          msg.role === "user"
                            ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 text-white"
                            : "bg-white/[0.05] border border-white/[0.08] text-white/90"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <div className="aurora-markdown">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => (
                                  <p className="mb-3 last:mb-0 leading-relaxed">
                                    {children}
                                  </p>
                                ),
                                strong: ({ children }) => (
                                  <strong className="font-semibold text-white">
                                    {children}
                                  </strong>
                                ),
                                ul: ({ children }) => (
                                  <ul className="mb-3 last:mb-0 space-y-1.5 ml-1">
                                    {children}
                                  </ul>
                                ),
                                ol: ({ children }) => (
                                  <ol className="mb-3 last:mb-0 space-y-1.5 ml-1 list-decimal list-inside">
                                    {children}
                                  </ol>
                                ),
                                li: ({ children }) => (
                                  <li className="leading-relaxed flex gap-2">
                                    <span className="text-teal-400 mt-0.5 shrink-0">•</span>
                                    <span>{children}</span>
                                  </li>
                                ),
                                em: ({ children }) => (
                                  <em className="text-teal-300/90 not-italic">{children}</em>
                                ),
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="leading-relaxed">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {isLoading && (
                  <div className="flex gap-3">
                    <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
                      <AvatarFallback className="bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 text-white text-xs font-bold">
                        A
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 flex gap-1.5 items-center">
                      <span className="w-2 h-2 rounded-full bg-teal-400/60 animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 rounded-full bg-teal-400/60 animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 rounded-full bg-teal-400/60 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                <div />
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className="shrink-0 p-3 pt-2 border-t border-white/[0.06]">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Aurora anything..."
                  disabled={isLoading}
                  className="flex-1 bg-white/[0.05] border-white/10 text-white placeholder:text-white/30 focus-visible:ring-teal-500/30 focus-visible:border-teal-500/50"
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="bg-gradient-to-br from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 border-0 text-white disabled:opacity-30"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[10px] text-white/20 mt-1.5 text-center">
                Aurora AI may make mistakes. Verify important financial decisions.
              </p>
            </div>

            {/* Resize handle — bottom-left corner */}
            <div
              onPointerDown={handleResizeStart}
              className="absolute bottom-0 left-0 w-5 h-5 cursor-nesw-resize z-10 group"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                className="absolute bottom-1 left-1 text-white/20 group-hover:text-teal-400/60 transition-colors"
              >
                <line x1="0" y1="12" x2="12" y2="0" stroke="currentColor" strokeWidth="1.5" />
                <line x1="0" y1="12" x2="7" y2="5" stroke="currentColor" strokeWidth="1.5" />
                <line x1="0" y1="12" x2="3" y2="9" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
