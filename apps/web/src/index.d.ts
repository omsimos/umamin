/* eslint-disable no-unused-vars */
export {};

declare global {
  interface Window {
    adsbygoogle: any;
  }
}

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode;
};
