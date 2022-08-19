import 'dotenv/config';

export default ({ config }) => {
  return {
    ...config,
    extra: {
      gqlEndpiont:
        process.env.GQL_ENDPOINT || 'http://localhost:3000/api/graphql',
      testExtra: 'text extra key',
    },
  };
};
