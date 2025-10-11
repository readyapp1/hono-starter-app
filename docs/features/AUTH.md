# Better Auth Integration Setup

This Hono API now includes Better Auth authentication with email/password support, configured for cross-origin requests from your Nuxt SPA.

## Environment Setup

### 1. Configure Environment Variables

Update the `.dev.vars` file with your actual values:

```bash
# .dev.vars
BETTER_AUTH_URL=http://localhost:8787
BETTER_AUTH_SECRET=your-secret-key-here-change-this-in-production
DATABASE_URL=your-neon-database-url-here
```

**Important:** Replace `your-secret-key-here-change-this-in-production` with a secure random string (32+ characters).

### 2. Production Deployment

For production deployment, set these as Cloudflare Worker secrets:

```bash
wrangler secret put BETTER_AUTH_URL
wrangler secret put BETTER_AUTH_SECRET  
wrangler secret put DATABASE_URL
```

## Available Authentication Endpoints

The following authentication endpoints are now available at `/api/auth/`:

### User Registration
```bash
POST /api/auth/sign-up/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "User Name"
}
```

### User Login
```bash
POST /api/auth/sign-in/email
Content-Type: application/json

{
  "email": "user@example.com", 
  "password": "securepassword"
}
```

### Get Current Session
```bash
GET /api/auth/get-session
```

### Logout
```bash
POST /api/auth/sign-out
```

## Usage from Nuxt SPA

### 1. Install Better Auth Client

In your Nuxt project:

```bash
npm install better-auth
```

### 2. Configure Better Auth Client

Create `plugins/better-auth.client.ts`:

```typescript
import { createAuthClient } from 'better-auth/react'

export default defineNuxtPlugin(() => {
  const authClient = createAuthClient({
    baseURL: 'http://localhost:8787/api/auth', // Your Hono API URL
  })
  
  return {
    provide: {
      auth: authClient
    }
  })
})
```

### 3. Use Authentication in Components

```vue
<template>
  <div>
    <div v-if="session">
      <p>Welcome, {{ session.user.name }}!</p>
      <button @click="signOut">Sign Out</button>
    </div>
    <div v-else>
      <button @click="signIn">Sign In</button>
    </div>
  </div>
</template>

<script setup>
const { $auth } = useNuxtApp()

const session = ref(null)

// Get current session
onMounted(async () => {
  session.value = await $auth.getSession()
})

// Sign in function
const signIn = async () => {
  await $auth.signIn.email({
    email: 'user@example.com',
    password: 'password'
  })
}

// Sign out function  
const signOut = async () => {
  await $auth.signOut()
}
</script>
```

## Development Commands

```bash
# Start development server
pnpm dev

# Generate Cloudflare Worker types
pnpm cf-typegen

# Regenerate Better Auth schema
pnpm better-auth-gen-schema

# Generate database migrations
pnpm db:generate

# Apply database migrations
pnpm db:migrate
```

## Database Schema

The following tables have been created in your Neon database:

- `user` - User accounts
- `session` - User sessions  
- `account` - OAuth accounts (if enabled)
- `verification` - Email verification tokens

## CORS Configuration

The API is configured to accept requests from any origin with credentials. For production, consider restricting the `origin` in `src/index.ts`:

```typescript
app.use('*', cors({
  origin: ['https://yourdomain.com', 'https://www.yourdomain.com'],
  credentials: true,
  // ... other options
}))
```

## Security Notes

1. **Change the secret key** in production
2. **Enable email verification** by setting `requireEmailVerification: true` in `src/lib/better-auth/options.ts`
3. **Restrict CORS origins** for production
4. **Use HTTPS** in production for secure cookie transmission

## Troubleshooting

### Database Connection Issues
- Verify your `DATABASE_URL` is correct
- Ensure your Neon database is accessible
- Check that `nodejs_compat` is enabled in `wrangler.jsonc`

### CORS Issues
- Ensure `credentials: true` is set in CORS config
- Verify the `baseURL` in your Nuxt client matches your API URL
- Check that cookies are being sent with requests

### Session Issues
- Verify `BETTER_AUTH_SECRET` is set and consistent
- Check that `BETTER_AUTH_URL` matches your API base URL
- Ensure cookies are enabled in your browser
