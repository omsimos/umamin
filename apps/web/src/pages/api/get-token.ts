import { getToken } from 'next-auth/jwt';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const token = await getToken({ req });
  if (token) {
    res.status(200).json(token);
  } else {
    res.status(401).json({ error: 'Not authorized' });
  }

  res.end();
}
