import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { ChatBot } from "@/components/chat-bot"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  return (
    <>
      {children}
      <ChatBot />
    </>
  )
}
