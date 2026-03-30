import { GraphQLClient } from 'graphql-request'
import { getAuthToken, getEffectiveToken, isTokenExpired, refreshAuthTokens } from './auth'

export const graphqlClient = new GraphQLClient(
  'https://api.start.gg/gql/alpha',
  {
    requestMiddleware: async (request) => {
      if (getAuthToken() && isTokenExpired()) {
        await refreshAuthTokens()
      }
      return {
        ...request,
        headers: {
          ...request.headers,
          Authorization: `Bearer ${getEffectiveToken()}`,
        },
      }
    },
  }
)
