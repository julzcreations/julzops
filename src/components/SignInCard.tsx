'use client'

import { signIn } from 'next-auth/react'
import { GoogleLogo, Sparkle } from '@phosphor-icons/react'

export function SignInCard() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl bg-white/70 backdrop-blur-sm shadow-card p-10 border border-pink-100">
        <div className="flex items-center gap-2 text-pink-600 mb-4">
          <Sparkle weight="fill" size={20} />
          <span className="text-sm tracking-wide uppercase">JulzOps</span>
        </div>
        <h1 className="font-display text-4xl text-purple-900 mb-2">Welcome back</h1>
        <p className="text-purple-700/70 mb-8">
          Your cozy ops dashboard. Sign in to peek at today&rsquo;s runs.
        </p>
        <button
          onClick={() => signIn('google')}
          className="w-full flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-500 text-white font-medium py-3 px-5 shadow-purple-glow hover:shadow-pink-glow transition-shadow"
        >
          <GoogleLogo weight="bold" size={18} />
          Sign in with Google
        </button>
        <p className="text-xs text-purple-600/50 mt-6 text-center">
          Single-user tool &middot; only Julie can enter
        </p>
      </div>
    </main>
  )
}
