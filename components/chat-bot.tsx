"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { MessageSquare, Send, X, Sparkles } from "lucide-react"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hey there! I'm Aurora, your AI financial coach. Ask me anything about budgeting, saving, spending smarter, or building wealth. How can I help you today?",
}

export function ChatBot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input when sheet opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
    }

    const updatedMessages = [...messages.filter((m) => m.id !== "welcome"), userMessage]
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

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I'm having trouble connecting right now. Please try again in a moment!",
      }
      setMessages((prev) => [...prev, errorMessage])
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Floating trigger button */}
      <SheetTrigger asChild>
        <Button
          size="icon-lg"
          className="fixed bottom-6 right-6 z-50 rounded-full w-14 h-14 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 shadow-xl shadow-teal-500/30 border-0 transition-all hover:scale-105"
        >
          {open ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <MessageSquare className="w-6 h-6 text-white" />
          )}
        </Button>
      </SheetTrigger>

      {/* Chat panel */}
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 border-white/10 bg-[#0b1120] flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="p-4 pb-3 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/25">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <SheetTitle className="text-white text-base">Aurora AI</SheetTitle>
              <p className="text-xs text-white/40">Your financial coach</p>
            </div>
          </div>
        </SheetHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 overflow-hidden">
          <div ref={scrollRef} className="p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar */}
                <Avatar className="w-8 h-8 flex-shrink-0 mt-0.5">
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

                {/* Bubble */}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 text-white"
                      : "bg-white/[0.05] border border-white/[0.08] text-white/90"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex gap-3">
                <Avatar className="w-8 h-8 flex-shrink-0 mt-0.5">
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
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="flex-shrink-0 p-4 pt-3 border-t border-white/[0.06]">
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
          <p className="text-[10px] text-white/20 mt-2 text-center">
            Aurora AI may make mistakes. Verify important financial decisions.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
