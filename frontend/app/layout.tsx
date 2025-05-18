import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'JudgeJam',
  description: '',
  generator: 'JudgeJam',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
