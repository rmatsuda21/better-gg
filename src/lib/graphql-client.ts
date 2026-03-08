import { GraphQLClient } from 'graphql-request'
import { getEffectiveToken } from './auth'

export const graphqlClient = new GraphQLClient(
  'https://api.start.gg/gql/alpha',
  {
    requestMiddleware: (request) => ({
      ...request,
      headers: {
        ...request.headers,
        Authorization: `Bearer ${getEffectiveToken()}`,
      },
    }),
  }
)
