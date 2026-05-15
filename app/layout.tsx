import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemedClerkProvider } from '@/components/themed-clerk-provider'
import { LenisProvider } from '@/components/lenis-provider'
import './globals.css'

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  title: 'Aurora - AI Financial Coach',
  description: 'From Chaos to Control to Growth. An AI financial coach that helps you spend smarter, stay in control, and build real wealth.',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable}`}>
      <body suppressHydrationWarning className="font-sans antialiased min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <ThemedClerkProvider>
            <LenisProvider />
            {children}
            <Analytics />
          </ThemedClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
