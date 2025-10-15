import { AwsClient } from 'aws4fetch'

// Create an AwsClient bound to the current environment
export function getAwsClient(env: Env): AwsClient {
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  })
}

// Sign a pre-signed PUT URL for a given object key in the `gallery` bucket
export async function signPresignedPut(
  env: Env,
  key: string,
  headers: Record<string, string>,
  expires: number = 86400 // 24 hours
): Promise<string> {
  const aws = getAwsClient(env)
  const url = `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/gallery/${key}`

  const req = await aws.sign(url, {
    method: 'PUT',
    headers,
    aws: {
      signQuery: true,
      expires,
      // Ensure headers like Content-Type are included in the signature
      allHeaders: true,
    },
  })

  return req.url
}


