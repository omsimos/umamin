/* eslint-disable */

/**
 * Disabled eslint here since `.tsx` is linting for "React" errors.
 * @vercel/og uses satori under the hood which is "React-like" but not React.
 *
 * Refer to this resource if you want to improve the implementation:
 * https://vercel.com/docs/functions/edge-functions/og-image-generation
 */

import { ImageResponse } from '@vercel/og';
import { NextApiRequest } from 'next';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextApiRequest) {
  const { searchParams } = new URL(req.url ?? '');

  const imageURL = searchParams.get('imageurl');
  const username = searchParams.get('username');

  const fontDataBold = await fetch(
    'https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Bold.otf'
  ).then((response) => response.arrayBuffer());

  const fontDataNormal = await fetch(
    'https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Regular.woff'
  ).then((response) => response.arrayBuffer());

  const errors: { type: string; message: string }[] = [];

  if (!imageURL)
    errors.push({
      type: 'VALIDATION',
      message: "Can't find image url. Use ?imageurl=<image url>.",
    });

  if (!username)
    errors.push({
      type: 'VALIDATION',
      message: "Can't find name. Use ?username=<username>.",
    });

  if (errors?.length) {
    return new Response(
      JSON.stringify(
        {
          errors: errors,
        },
        null,
        2
      )
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          fontSize: 50,
          fontFamily: 'Inter',
          background: '#151618',
          width: '800px',
          height: '400px',
          margin: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginLeft: '80px',
            marginRight: '60px',
            marginTop: '50px',
            gap: 20,
            height: 120,
          }}
        >
          <img
            alt=''
            src={imageURL!} // validated with `errors?.length`
            style={{
              position: 'relative',
              display: 'flex',
              borderRadius: 999,
              backgroundColor: '#151618',
              objectFit: 'cover',
              objectPosition: 'center',
              width: 90,
              height: 90,
              overflow: 'hidden',
              border: '1px solid #8E8E93',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <p
              style={{
                color: 'white',
                margin: 0,
                padding: 0,
                fontSize: 40,
                paddingBottom: 5,
                fontFamily: 'Inter',
                fontWeight: 600,
              }}
            >
              {username}
            </p>
            <p
              style={{
                color: '#FF00A9',
                fontSize: 24,
                margin: 0,
                padding: 0,
              }}
            >
              umamin.link/to/{username}
            </p>
          </div>
        </div>

        <img
          src='https://github-production-user-asset-6210df.s3.amazonaws.com/69457996/279576464-29426fc7-0ef4-4969-8096-1ec72226a80c.png'
          style={{
            position: 'absolute',
            bottom: 10,
            right: 10,
            width: 300,
          }}
        />
      </div>
    ),
    {
      width: 800,
      height: 400,
      fonts: [
        {
          name: 'Inter',
          data: fontDataBold,
          weight: 700,
        },
        {
          name: 'Inter',
          data: fontDataNormal,
          weight: 400,
        },
      ],
    }
  );
}

