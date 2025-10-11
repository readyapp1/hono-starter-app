import { BetterAuthOptions } from 'better-auth';

/**
 * Custom options for Better Auth
 *
 * Docs: https://www.better-auth.com/docs/reference/options
 */
export const betterAuthOptions: BetterAuthOptions = {
  /**
   * The name of the application.
   */
  appName: 'Hono Auth API',
  /**
   * Base path for Better Auth.
   * @default "/api/auth"
   */
  basePath: '/api/auth',

  /**
   * Email and password authentication
   */
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
  },

  /**
   * Session configuration
   */
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },

  /**
   * Trusted origins for CORS (allow all origins initially)
   */
  trustedOrigins: ['*'],

  /**
   * Advanced options
   */
  advanced: {
    generateId: true,
    crossSubDomainCookies: {
      enabled: false,
    },
  },
};
