import 'next-auth';

declare module 'next-auth' {
  // eslint-disable-next-line no-unused-vars
  interface Session {
    user?: {
      id?: string;
      username?: string;
      email?: string;
      image?: string;
    };
  }
}
