const description =
  'The ultimate platform for sending and receiving anonymous messages!';

export default {
  title: 'Umamin',
  description,
  openGraph: {
    type: 'website',
    url: 'https://umamin.link',
    title: 'Send & Receive Anonymous Confessions',
    description,
    images: [
      {
        url: '/assets/banner.jpg',
        width: 1400,
        height: 800,
        alt: 'umamin',
        type: 'image/jpg',
      },
    ],
    site_name: 'Umamin',
  },
  twitter: {
    cardType: 'summary_large_image',
  },
  additionalLinkTags: [
    {
      rel: 'icon',
      href: '/favicon.ico',
      type: 'image/x-icon',
    },
    {
      rel: 'apple-touch-icon',
      href: '/icons/icon-144.png',
      sizes: '144x144',
    },
    {
      rel: 'manifest',
      href: '/manifest.json',
    },
  ],
  additionalMetaTags: [
    {
      name: 'viewport',
      content: 'initial-scale=1, viewport-fit=cover, user-scalable=no',
    },
  ],
};
