import './globals.css'
import type { Metadata } from 'next'
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs'

export const metadata: Metadata = {
  title: 'OrderGuard - Etsy Order Protection',
  description: 'Protect your Etsy shop from refunds and disputes with intelligent tracking monitoring',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      afterSignInUrl="/"
      afterSignUpUrl="/"
    >
      <html lang="en">
        <body>
          <SignedIn>
            {children}
          </SignedIn>
          <SignedOut>
            <RedirectToSignIn />
          </SignedOut>
        </body>
      </html>
    </ClerkProvider>
  )
}
