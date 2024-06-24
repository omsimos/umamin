import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { body, method } = req;
  const { captcha } = body;

  if (method === 'POST') {
    if (!captcha) {
      return res.status(422).json({
        message: 'Unproccesable request',
      });
    }

    try {
      const response = await fetch(`https://hcaptcha.com/siteverify`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        },
        body: `response=${captcha}&secret=${process.env.HCAPTCHA_SECRET_KEY}`,
        method: 'POST',
      });

      const captchaValidation = await response.json();

      if (captchaValidation.success) {
        return res.status(200).send('OK');
      }

      return res.status(422).json({
        message: 'Unproccesable request, Invalid captcha code',
      });
    } catch (error) {
      return res.status(422).json({ message: 'Something went wrong' });
    }
  }

  return res
    .status(405)
    .json({ message: `Method [${req.method}] not allowed.`, statusCode: 405 });
}
