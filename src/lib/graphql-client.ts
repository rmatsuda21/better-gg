import { GraphQLClient } from 'graphql-request'

export const graphqlClient = new GraphQLClient(
  'https://api.start.gg/gql/alpha',
  {
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_START_GG_TOKEN}`,
    },
  }
)
