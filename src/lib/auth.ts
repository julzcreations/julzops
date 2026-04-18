import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

// Single-user ops dashboard. Only this email is allowed past sign-in.
const ALLOWED_EMAIL = 'julie.yue.2011@gmail.com'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/',
  },
  callbacks: {
    async signIn({ profile }) {
      return profile?.email?.toLowerCase() === ALLOWED_EMAIL
    },
    async jwt({ token, profile }) {
      if (profile?.email) token.email = profile.email
      return token
    },
    async session({ session, token }) {
      if (session.user && token.email) session.user.email = token.email as string
      return session
    },
    async redirect({ url, baseUrl }) {
      if (url === baseUrl || url === `${baseUrl}/`) return baseUrl
      return url.startsWith(baseUrl) ? url : baseUrl
    },
  },
}
