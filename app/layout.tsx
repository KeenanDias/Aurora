import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

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
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#14b8a6',
          colorBackground: '#0b1120',
          colorInputBackground: '#111827',
          colorInputText: '#e2e8f0',
        },
      }}
    >
      <html lang="en">
        <body className="font-sans antialiased" suppressHydrationWarning>
          {children}
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  )
}
