import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import prisma from '@/lib/db';
import { isPassword } from '@/utils/helpers';

export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
});

export type AuthedUser = z.infer<typeof userSchema>;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'POST') {
    const { username, password } = JSON.parse(req.body);

    if (!username && typeof username !== 'string') {
      return res
        .status(400)
        .json({ message: 'Username is required', statusCode: 400 });
    }

    if (!password && typeof password !== 'string') {
      return res
        .status(400)
        .json({ message: 'Password is required', statusCode: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, password: true, username: true },
    });

    if (user && user.password && isPassword(password, user.password)) {
      try {
        const data = await userSchema.parseAsync(user);
        return res.status(200).json(data);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        return res
          .status(401)
          .json({ message: 'Validation error', statusCode: 401 });
      }
    }

    return res
      .status(401)
      .json({ message: 'Invalid credentials', statusCode: 401 });
  }

  return res
    .status(405)
    .json({ message: `Method [${req.method}] not allowed.`, statusCode: 405 });
};

export default handler;
