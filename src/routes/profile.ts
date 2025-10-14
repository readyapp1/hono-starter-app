import { Hono } from 'hono'
import { AwsClient } from 'aws4fetch'
import { auth } from '../lib/better-auth'
import { eq } from 'drizzle-orm'
import { user } from '../db/schema'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

const profile = new Hono<{ Bindings: Env }>()

// Helper function to get database connection
const getDb = (env: Env) => {
  const sql = neon(env.DATABASE_URL)
  return drizzle(sql)
}

// GET /api/user/profile - Fetch current user profile
profile.get('/profile', async (c) => {
  try {
    // Validate authentication
    const session = await auth(c.env).api.getSession({
      headers: c.req.raw.headers
    })

    if (!session) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    // Get user from database
    const db = getDb(c.env)
    const userRecord = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)

    if (userRecord.length === 0) {
      return c.json({ error: 'User not found' }, 404)
    }

    const userData = userRecord[0]

    // Return user profile (exclude sensitive fields)
    return c.json({
      id: userData.id,
      name: userData.name,
      email: userData.email,
      image: userData.image,
      emailVerified: userData.emailVerified,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt
    })

  } catch (error) {
    console.error('Error fetching user profile:', error)
    return c.json({ 
      error: 'Internal server error' 
    }, 500)
  }
})

// POST /api/user/profile - Update user profile
profile.post('/profile', async (c) => {
  try {
    // Validate authentication
    const session = await auth(c.env).api.getSession({
      headers: c.req.raw.headers
    })

    if (!session) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    // Parse request body
    const body = await c.req.json()
    const { name, image } = body

    // Validate required fields
    if (!name) {
      return c.json({ 
        error: 'Name is required' 
      }, 400)
    }

    // Validate name length
    if (name.length < 1 || name.length > 100) {
      return c.json({ 
        error: 'Name must be between 1 and 100 characters' 
      }, 400)
    }

    // Update user in database
    const db = getDb(c.env)
    const updatedUser = await db.update(user)
      .set({
        name,
        image: image || null, // Allow clearing image by passing null
        updatedAt: new Date()
      })
      .where(eq(user.id, session.user.id))
      .returning()

    if (updatedUser.length === 0) {
      return c.json({ error: 'User not found' }, 404)
    }

    const userData = updatedUser[0]

    // Return updated user profile
    return c.json({
      success: true,
      user: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        image: userData.image,
        emailVerified: userData.emailVerified,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt
      }
    })

  } catch (error) {
    console.error('Error updating user profile:', error)
    return c.json({ 
      error: 'Internal server error' 
    }, 500)
  }
})

// GET /api/user/profile/image - Get profile image download URL
profile.get('/profile/image', async (c) => {
  try {
    // Validate authentication
    const session = await auth(c.env).api.getSession({
      headers: c.req.raw.headers
    })

    if (!session) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    // Get user from database
    const db = getDb(c.env)
    const userRecord = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)

    if (userRecord.length === 0) {
      return c.json({ error: 'User not found' }, 404)
    }

    const userData = userRecord[0]

    // Check if user has a profile image
    if (!userData.image) {
      return c.json({
        hasImage: false,
        message: 'No profile image set'
      })
    }

    // Create AWS client for R2 using aws4fetch (Workers-compatible)
    const aws = new AwsClient({
      accessKeyId: c.env.R2_ACCESS_KEY_ID,
      secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
      service: 's3',
      region: 'auto',
    })

    // Construct the R2 bucket URL for download
    const bucketUrl = `https://${c.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/gallery/${userData.image}`

    // Create a signed request for GET operation with query string signing
    const signedRequest = await aws.sign(bucketUrl, {
      method: 'GET',
      aws: { 
        signQuery: true
      } 
    })

    // Extract the pre-signed URL and add expiration parameter
    const presignedUrl = new URL(signedRequest.url)
    presignedUrl.searchParams.set('X-Amz-Expires', '3600') // 1 hour expiration
    
    const downloadUrl = presignedUrl.toString()

    // Return download URL and metadata
    return c.json({
      hasImage: true,
      downloadUrl,
      filename: userData.image,
      expiresIn: 3600
    })

  } catch (error) {
    console.error('Error generating profile image download URL:', error)
    return c.json({ 
      error: 'Internal server error' 
    }, 500)
  }
})

export default profile
