import { ExpoConfig } from '@expo/config';
import { z } from 'zod';
import 'dotenv/config';

export const envSchema = z.object({
  GQL_ENDPOINT: z.string().url(),
});

export default ({ config }: any): ExpoConfig => {
  try {
    const schema = envSchema.parse(process.env);
    return {
      ...config,
      extra: {
        gqlEndpiont: schema.GQL_ENDPOINT,
      },
    };
  } catch (e) {
    if (e instanceof z.ZodError) {
      console.log('------- INVALID .env file -------');
      Object.entries(e.flatten().fieldErrors).map(([k, errs], idx) => {
        console.log(`${k}: ${errs?.join(',')}`);
      });
      console.log('---------------------------------');
      return process.exit(1);
    }

    console.log('Something went wrong.');
    console.error(e);
    return process.exit(1);
  }
};
