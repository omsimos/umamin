/* eslint-disable no-param-reassign */
import { NextApiHandler } from 'next';
import NextAuth, { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import CredentialsProvider from 'next-auth/providers/credentials';

import { prisma } from '@/db';
import { AuthedUser } from '../authorize';

const options: NextAuthOptions = {
  debug: true,
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: 'https://discord.com/api/oauth2/authorize',
      token: 'https://discord.com/api/oauth2/token',
    }),
    CredentialsProvider({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        username: {
          label: 'Username',
          type: 'text',
        },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const res = await fetch(`${process.env.NEXTAUTH_URL}/api/authorize`, {
          method: 'POST',
          body: JSON.stringify({
            username: credentials?.username,
            password: credentials?.password,
          }),
        });

        if (res.ok) {
          const user = (await res.json()) as AuthedUser;
          return user;
        }

        return Promise.reject(new Error('Invalid credentials'));
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }

      if (user) {
        token.username = user.username;
      }

      return token;
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken;

      if (session.user) {
        session.user.id = token.sub;
        session.user.username = token.username as string;
      }
      return session;
    },

    async signIn({ user: { email }, account }) {
      if (account.provider === 'discord') {
        if (!email) {
          return '/register';
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          return '/register';
        }

        return true;
      }

      return true;
    },
  },
  session: { strategy: 'jwt' },
};

const authHandler: NextApiHandler = (req, res) => NextAuth(req, res, options);

export default authHandler;
