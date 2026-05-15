"use client"

import ReactMarkdown from "react-markdown"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export type ChatRole = "user" | "assistant"

export function ChatAvatar({ role }: { role: ChatRole }) {
  return (
    <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
      <AvatarFallback
        className={
          role === "assistant"
            ? "bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 text-white text-xs font-bold"
            : "bg-muted text-foreground/80 text-xs font-medium"
        }
      >
        {role === "assistant" ? "A" : "U"}
      </AvatarFallback>
    </Avatar>
  )
}

export function ChatBubble({ role, content }: { role: ChatRole; content: string }) {
  return (
    <div className={`flex gap-3 ${role === "user" ? "flex-row-reverse" : "flex-row"}`}>
      <ChatAvatar role={role} />
      <div
        className={`max-w-[85%] w-full rounded-2xl px-4 py-3 text-sm ${
          role === "user"
            ? "bg-gradient-to-br from-aurora-emerald/20 to-aurora-teal/20 border border-aurora-emerald/30 text-foreground"
            : "bg-muted/60 border border-border/60 text-foreground"
        }`}
      >
        {role === "assistant" ? (
          <div className="aurora-markdown">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">{children}</strong>
                ),
                ul: ({ children }) => <ul className="mb-3 last:mb-0 space-y-1.5 ml-1">{children}</ul>,
                ol: ({ children }) => (
                  <ol className="mb-3 last:mb-0 space-y-1.5 ml-1 list-decimal list-inside">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="leading-relaxed flex gap-2">
                    <span className="text-teal-400 mt-0.5 shrink-0">•</span>
                    <span>{children}</span>
                  </li>
                ),
                em: ({ children }) => <em className="text-teal-300/90 not-italic">{children}</em>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="leading-relaxed whitespace-pre-wrap">{content}</p>
        )}
      </div>
    </div>
  )
}

export function ChatTypingDots() {
  return (
    <div className="flex gap-3">
      <ChatAvatar role="assistant" />
      <div className="bg-muted/60 border border-border/60 rounded-2xl px-4 py-3 flex gap-1.5 items-center">
        <span className="w-2 h-2 rounded-full bg-teal-400/60 animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-teal-400/60 animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-teal-400/60 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  )
}
