# R2 File Upload Feature Documentation

## Overview

This feature enables authenticated file uploads directly from the frontend to Cloudflare R2 storage using pre-signed URLs. Files are limited to images up to 10MB in size.

## Setup Instructions

### 1. Enable R2 in Cloudflare Dashboard

Before creating the bucket, you need to enable R2 in your Cloudflare account:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2 Object Storage**
3. Click **Enable R2** if not already enabled
4. Accept the terms and conditions

### 2. Create R2 Bucket

```bash
# Create the gallery bucket
npx wrangler r2 bucket create gallery
```

### 3. Configure CORS Policy

Create a CORS policy file to allow direct uploads from your frontend:

```bash
# Create cors.json file
cat > cors.json << EOF
{
  "rules": [
    {
      "allowed": {
        "methods": ["PUT", "GET", "POST","DELETE"],
        "origins": ["*"],
        "headers": ["Content-Type", "Authorization"]
      },
      "exposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

# Apply CORS policy to the bucket
npx wrangler r2 bucket cors set gallery --file=cors.json
```

### 4. Create R2 API Token

You need to create API credentials for the S3-compatible API:

1. Go to **R2 Object Storage** in Cloudflare Dashboard
2. Click **Manage R2 API tokens**
3. Click **Create API token**
4. Choose **Custom token**
5. Set permissions:
   - **Object Read & Write** for the `gallery` bucket
6. Copy the **Access Key ID** and **Secret Access Key**

### 5. Configure Environment Variables

**For Development**: Add the following environment variables to your `.dev.vars` file:

```bash
# R2 API Credentials (get these from Cloudflare Dashboard)
CLOUDFLARE_ACCOUNT_ID=your-account-id-here
R2_ACCESS_KEY_ID=your-r2-access-key-id-here
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key-here
```

**For Production**: Set these as Cloudflare Worker Secrets:

```bash
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID  
npx wrangler secret put R2_SECRET_ACCESS_KEY
```

You can find your Account ID in the Cloudflare Dashboard sidebar.

### 6. Deploy the Application

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

## API Endpoint

### POST `/api/uploads/pre-signed-url`

Generates a pre-signed URL for direct file upload to R2.

**Authentication**: Required (Better Auth session)

**Request Body**:
```json
{
  "filename": "example.jpg",
  "contentType": "image/jpeg",
  "fileSize": 1024000
}
```

**Response**:
```json
{
  "presignedUrl": "https://gallery.your-account.r2.cloudflarestorage.com/...",
  "filename": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg",
  "originalFilename": "example.jpg",
  "contentType": "image/jpeg",
  "fileSize": 1024000,
  "expiresIn": 3600
}
```

**Error Responses**:
- `401`: Authentication required
- `400`: Missing required fields, invalid file type, or file size exceeds 10MB
- `500`: Internal server error

## Frontend Integration Example

### 1. Request Pre-signed URL

```javascript
const getPresignedUrl = async (file) => {
  const response = await fetch('/api/uploads/pre-signed-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include cookies for authentication
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      fileSize: file.size,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get pre-signed URL');
  }

  return await response.json();
};
```

### 2. Upload File to R2

```javascript
const uploadFile = async (file) => {
  try {
    // Step 1: Get pre-signed URL
    const { presignedUrl, filename } = await getPresignedUrl(file);

    // Step 2: Upload file directly to R2
    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file');
    }

    console.log('File uploaded successfully:', filename);
    return filename;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
};
```

### 3. Complete Upload Component Example

```javascript
const FileUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    
    for (const file of files) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Only image files are allowed');
        continue;
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        continue;
      }

      setUploading(true);
      try {
        const filename = await uploadFile(file);
        setUploadedFiles(prev => [...prev, { filename, originalName: file.name }]);
      } catch (error) {
        console.error('Upload failed:', error);
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileUpload}
        disabled={uploading}
      />
      {uploading && <p>Uploading...</p>}
      <div>
        <h3>Uploaded Files:</h3>
        {uploadedFiles.map((file, index) => (
          <div key={index}>
            <p>Original: {file.originalName}</p>
            <p>Stored as: {file.filename}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## File Storage Details

- **Filename Generation**: Uses `crypto.randomUUID()` + file extension
- **Metadata Storage**: Original filename stored in R2 object metadata
- **File Size Limit**: 10MB per file
- **Supported Types**: All image MIME types (`image/*`)
- **URL Expiration**: 1 hour
- **Storage Location**: `gallery` R2 bucket

## Security Features

- **Authentication Required**: Only authenticated users can generate pre-signed URLs
- **File Type Validation**: Only image files are allowed
- **Size Limits**: 10MB maximum file size enforced
- **Unique Filenames**: UUID-based naming prevents conflicts and directory traversal
- **Metadata Tracking**: User ID and upload timestamp stored with each file

## Troubleshooting

### Common Issues

1. **"R2 not enabled" error**: Enable R2 in Cloudflare Dashboard first
2. **CORS errors**: Ensure CORS policy is properly configured
3. **Authentication errors**: Verify Better Auth session is working
4. **Upload failures**: Check R2 API credentials and bucket permissions

### Debugging

Enable debug logging by checking the Cloudflare Workers logs:

```bash
npx wrangler tail
```

## Next Steps

- Implement file listing/deletion endpoints
- Add image resizing/optimization
- Set up CDN for faster file delivery
- Add file access controls and sharing
