const description =
  'An ad-free and open-source platform for sending and receiving anonymous confessions! Start receiving anonymous messages with umamin!';

const imgUrl =
  'https://user-images.githubusercontent.com/69457996/179454243-4ea5227b-2a10-4276-8ddb-bdc6da645463.png';

export default {
  title: 'umamin',
  description,
  openGraph: {
    type: 'website',
    url: 'https://umamin.link',
    title: 'Send & Receive Anonymous Confessions',
    description,
    images: [
      {
        url: imgUrl,
        width: 1400,
        height: 800,
        alt: 'umamin',
        type: 'image/png',
      },
    ],
    site_name: 'umamin',
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
      href: '/icons/apple-touch-icon.png',
      sizes: '180x180',
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
