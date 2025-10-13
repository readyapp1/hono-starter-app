import { Hono } from 'hono'
import { AwsClient } from 'aws4fetch'
import { auth } from '../lib/better-auth'
import { randomUUID } from 'crypto'

const uploads = new Hono<{ Bindings: Env }>()

// Helper function to validate image MIME type
function isValidImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

// Helper function to get file extension from MIME type
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
  }
  return mimeToExt[mimeType] || '.jpg' // Default to .jpg if unknown
}

uploads.post('/pre-signed-url', async (c) => {
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
    const { filename, contentType, fileSize } = body

    // Validate required fields
    if (!filename || !contentType || !fileSize) {
      return c.json({ 
        error: 'Missing required fields: filename, contentType, fileSize' 
      }, 400)
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB in bytes
    if (fileSize > maxSize) {
      return c.json({ 
        error: 'File size exceeds 10MB limit' 
      }, 400)
    }

    // Validate content type (must be image)
    if (!isValidImageType(contentType)) {
      return c.json({ 
        error: 'Only image files are allowed' 
      }, 400)
    }

    // Generate unique filename using UUID
    const fileExtension = getExtensionFromMimeType(contentType)
    const uniqueFilename = `${randomUUID()}${fileExtension}`

    // Create AWS client for R2 using aws4fetch (Workers-compatible)
    const aws = new AwsClient({
      accessKeyId: c.env.R2_ACCESS_KEY_ID,
      secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
      service: 's3',
      region: 'auto',
    })

    // Construct the R2 bucket URL (correct format for R2)
    const bucketUrl = `https://${c.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/gallery/${uniqueFilename}`

    // Create a signed request for PUT operation with query string signing
    // This creates a pre-signed URL that expires in 1 hour
    const signedRequest = await aws.sign(bucketUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileSize.toString(),
        'x-amz-meta-original-filename': filename,
        'x-amz-meta-uploaded-by': session.user.id,
        'x-amz-meta-uploaded-at': new Date().toISOString(),
      },
      aws: { 
        signQuery: true
      } 
    })

    // Extract the pre-signed URL and add expiration parameter
    const presignedUrl = new URL(signedRequest.url)
    presignedUrl.searchParams.set('X-Amz-Expires', '3600') // 1 hour expiration
    
    const finalPresignedUrl = presignedUrl.toString()

    // Return the pre-signed URL and metadata
    return c.json({
      presignedUrl: finalPresignedUrl,
      filename: uniqueFilename,
      originalFilename: filename,
      contentType,
      fileSize,
      expiresIn: 3600,
    })

  } catch (error) {
    console.error('Error generating pre-signed URL:', error)
    return c.json({ 
      error: 'Internal server error' 
    }, 500)
  }
})

export default uploads
