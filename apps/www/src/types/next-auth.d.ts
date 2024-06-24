/* eslint-disable no-unused-vars */
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user?: {
      id?: string;
      name?: string;
      email?: string;
      image?: string;
      username?: string;
    };
  }

  interface User {
    username: string;
  }
}
