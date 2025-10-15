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

Create a CORS policy file to allow direct uploads from your frontend. **Important**: Cloudflare R2 requires explicit header names instead of wildcards:

```bash
# Create cors.json file
cat > cors.json << EOF
{
  "rules": [
    {
      "allowed": {
        "methods": ["PUT", "GET", "POST", "DELETE"],
        "origins": ["*"],
        "headers": ["content-type", "x-amz-meta-original-filename", "x-amz-meta-uploaded-at", "x-amz-meta-uploaded-by"]
      },
      "exposeHeaders": ["ETag"],
      "maxAgeSeconds": 3000
    }
  ]
}
EOF

# Apply CORS policy to the bucket
npx wrangler r2 bucket cors set gallery --file=cors.json
```

**Critical Note**: Unlike AWS S3, Cloudflare R2 does not support `"headers": ["*"]` wildcards. You must specify each header explicitly, including:
- `content-type` (required for PUT requests)
- `x-amz-meta-original-filename` (custom metadata)
- `x-amz-meta-uploaded-at` (custom metadata)  
- `x-amz-meta-uploaded-by` (custom metadata)

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
  "expiresIn": 86400,
  "uploadedBy": "user-id-here",
  "uploadedAt": "2025-01-13T20:45:00.000Z"
}
```

**Error Responses**:
- `401`: Authentication required
- `400`: Missing required fields, invalid file type, or file size exceeds 10MB
- `500`: Internal server error

### User Profile Endpoints

#### GET `/api/user/profile`

Fetches the current user's profile information.

**Authentication**: Required (Better Auth session)

**Response**:
```json
{
  "id": "user-id",
  "name": "John Doe",
  "email": "john@example.com",
  "image": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg",
  "emailVerified": true,
  "createdAt": "2025-01-13T10:00:00Z",
  "updatedAt": "2025-01-13T10:30:00Z"
}
```

**Error Responses**:
- `401`: Authentication required
- `404`: User not found
- `500`: Internal server error

#### POST `/api/user/profile`

Updates the current user's profile information.

**Authentication**: Required (Better Auth session)

**Request Body**:
```json
{
  "name": "John Doe",
  "image": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg"
}
```

**Response**:
```json
{
  "success": true,
  "user": {
    "id": "user-id",
    "name": "John Doe",
    "email": "john@example.com",
    "image": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg",
    "emailVerified": true,
    "createdAt": "2025-01-13T10:00:00Z",
    "updatedAt": "2025-01-13T10:30:00Z"
  }
}
```

**Error Responses**:
- `401`: Authentication required
- `400`: Missing required fields or validation errors
- `404`: User not found
- `500`: Internal server error

#### GET `/api/user/profile/image`

Generates a pre-signed download URL for the user's profile image.

**Authentication**: Required (Better Auth session)

**Response** (when user has an image):
```json
{
  "hasImage": true,
  "downloadUrl": "https://gallery.account.r2.cloudflarestorage.com/xxx?signature=...",
  "filename": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg",
  "expiresIn": 3600
}
```

**Response** (when user has no image):
```json
{
  "hasImage": false,
  "message": "No profile image set"
}
```

**Error Responses**:
- `401`: Authentication required
- `404`: User not found
- `500`: Internal server error

#### POST `/api/user/profile/image`

Issues a pre-signed PUT URL for uploading the user's profile image using a stable key that overwrites the existing object. The key is stored in `user.image` (UUID without extension). First call sets the key if missing; subsequent calls reuse it.

**Authentication**: Required (Better Auth session)

**Request Body**:
```json
{
  "contentType": "image/png",
  "fileSize": 301486,
  "originalFilename": "avatar.png"
}
```

**Response**:
```json
{
  "presignedUrl": "https://.../gallery/<stable-uuid>?X-Amz-...",
  "key": "<stable-uuid>",
  "contentType": "image/png",
  "fileSize": 301486,
  "expiresIn": 86400,
  "uploadedBy": "user-id",
  "uploadedAt": "2025-01-13T20:45:00.000Z",
  "originalFilename": "avatar.png"
}
```

**Upload Instructions (frontend)**:
- PUT the file to `presignedUrl` with headers:
  - `Content-Type: <file.type>`
  - `x-amz-meta-original-filename: <response.originalFilename>`
  - `x-amz-meta-uploaded-by: <response.uploadedBy>`
  - `x-amz-meta-uploaded-at: <response.uploadedAt>`

**Overwrite Semantics**:
- The same key is reused for all future profile uploads, so the object is overwritten instead of creating new objects.

## Complete Profile Management Flow

### Frontend Implementation Example

Here's how to implement the complete profile management flow in your frontend:

```typescript
// Complete profile management composable
export const useProfile = () => {
  const { $fetch } = useNuxtApp()
  
  const profile = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Load user profile
  const loadProfile = async () => {
    loading.value = true
    error.value = null
    
    try {
      profile.value = await $fetch('/api/user/profile', {
        credentials: 'include'
      })
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  // Update user profile
  const updateProfile = async (updates: { name?: string; image?: string }) => {
    loading.value = true
    error.value = null
    
    try {
      const response = await $fetch('/api/user/profile', {
        method: 'POST',
        body: updates,
        credentials: 'include'
      })
      
      profile.value = response.user
      return response.user
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // Get profile image URL
  const getProfileImageUrl = async () => {
    try {
      const response = await $fetch('/api/user/profile/image', {
        credentials: 'include'
      })
      
      return response.hasImage ? response.downloadUrl : null
    } catch (err) {
      console.error('Failed to get profile image URL:', err)
      return null
    }
  }

  // Complete profile update flow
  const updateProfileWithImage = async (file: File, name: string) => {
    try {
      // Step 1: Upload image
      const { uploadFile } = useFileUpload()
      const uploadedFile = await uploadFile(file)
      
      // Step 2: Update profile with new image
      const updatedProfile = await updateProfile({
        name,
        image: uploadedFile.filename
      })
      
      return updatedProfile
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  return {
    profile: readonly(profile),
    loading: readonly(loading),
    error: readonly(error),
    loadProfile,
    updateProfile,
    getProfileImageUrl,
    updateProfileWithImage
  }
}
```

### Profile Component Example

```vue
<template>
  <div class="profile-management">
    <div v-if="loading" class="loading">Loading profile...</div>
    
    <div v-else-if="error" class="error">{{ error }}</div>
    
    <div v-else class="profile-content">
      <!-- Profile Image -->
      <div class="profile-image-section">
        <img 
          v-if="profileImageUrl" 
          :src="profileImageUrl" 
          :alt="profile?.name"
          class="profile-image"
        />
        <div v-else class="no-image">
          <Icon name="user" />
        </div>
        
        <FileUpload 
          :max-files="1"
          @upload="handleImageUpload"
          @error="handleUploadError"
        />
      </div>

      <!-- Profile Form -->
      <form @submit.prevent="handleSubmit" class="profile-form">
        <div class="form-group">
          <label for="name">Name</label>
          <input 
            id="name"
            v-model="form.name" 
            type="text" 
            required 
            :disabled="loading"
          />
        </div>
        
        <button type="submit" :disabled="loading">
          {{ loading ? 'Updating...' : 'Update Profile' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
const { profile, loading, error, loadProfile, updateProfile, getProfileImageUrl, updateProfileWithImage } = useProfile()

const form = ref({
  name: '',
  image: null as File | null
})

const profileImageUrl = ref<string | null>(null)

// Load profile on mount
onMounted(async () => {
  await loadProfile()
  if (profile.value) {
    form.value.name = profile.value.name
    profileImageUrl.value = await getProfileImageUrl()
  }
})

// Handle image upload
const handleImageUpload = async (files: any[]) => {
  if (files.length > 0) {
    form.value.image = files[0]
  }
}

const handleUploadError = (error: Error) => {
  console.error('Upload error:', error)
}

// Handle form submission
const handleSubmit = async () => {
  try {
    if (form.value.image) {
      // Update with new image
      await updateProfileWithImage(form.value.image, form.value.name)
    } else {
      // Update name only
      await updateProfile({ name: form.value.name })
    }
    
    // Refresh profile image URL
    profileImageUrl.value = await getProfileImageUrl()
    
    // Show success message
    useToast().add({
      title: 'Profile Updated',
      description: 'Your profile has been updated successfully',
      color: 'green'
    })
  } catch (err) {
    useToast().add({
      title: 'Update Failed',
      description: err.message,
      color: 'red'
    })
  }
}
</script>
```

## Frontend Integration Examples

### Nuxt SPA Implementation

#### 1. Types and Interfaces

Create `types/upload.ts`:

```typescript
export interface UploadRequest {
  filename: string
  contentType: string
  fileSize: number
}

export interface UploadResponse {
  presignedUrl: string
  filename: string
  originalFilename: string
  contentType: string
  fileSize: number
  expiresIn: number
}

export interface UploadedFile {
  filename: string
  originalName: string
  contentType: string
  fileSize: number
  uploadedAt: string
}

export interface UploadError {
  message: string
  code?: string
  details?: any
}
```

#### 2. Upload Composable

Create `composables/useFileUpload.ts`:

```typescript
import type { UploadRequest, UploadResponse, UploadedFile, UploadError } from '~/types/upload'

export const useFileUpload = () => {
  const { $fetch } = useNuxtApp()
  
  const uploading = ref(false)
  const uploadProgress = ref(0)
  const uploadedFiles = ref<UploadedFile[]>([])
  const error = ref<UploadError | null>(null)

  // Validate file before upload
  const validateFile = (file: File): string | null => {
    // Check file type
    if (!file.type.startsWith('image/')) {
      return 'Only image files are allowed'
    }

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return 'File size must be less than 10MB'
    }

    return null
  }

  // Get pre-signed URL from API
  const getPresignedUrl = async (file: File): Promise<UploadResponse> => {
    const uploadRequest: UploadRequest = {
      filename: file.name,
      contentType: file.type,
      fileSize: file.size
    }

    try {
      const response = await $fetch<UploadResponse>('/api/uploads/pre-signed-url', {
        method: 'POST',
        body: uploadRequest,
        credentials: 'include'
      })
      
      return response
    } catch (err: any) {
      throw new Error(`Failed to get pre-signed URL: ${err.message || 'Unknown error'}`)
    }
  }

  // Upload file directly to R2
  const uploadToR2 = async (file: File, presignedUrl: string, metadata: any): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          uploadProgress.value = Math.round((event.loaded / event.total) * 100)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`Upload failed with status: ${xhr.status}`))
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed due to network error'))
      })

      xhr.open('PUT', presignedUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      // Add metadata headers that match the signed headers
      xhr.setRequestHeader('x-amz-meta-original-filename', metadata.originalFilename)
      xhr.setRequestHeader('x-amz-meta-uploaded-by', metadata.uploadedBy)
      xhr.setRequestHeader('x-amz-meta-uploaded-at', metadata.uploadedAt)
      xhr.send(file)
    })
  }

  // Main upload function
  const uploadFile = async (file: File): Promise<UploadedFile> => {
    // Validate file
    const validationError = validateFile(file)
    if (validationError) {
      throw new Error(validationError)
    }

    uploading.value = true
    uploadProgress.value = 0
    error.value = null

    try {
      // Step 1: Get pre-signed URL
      const { presignedUrl, filename, originalFilename, contentType, fileSize, uploadedBy, uploadedAt } = await getPresignedUrl(file)

      // Step 2: Upload file directly to R2 with metadata
      await uploadToR2(file, presignedUrl, {
        originalFilename,
        uploadedBy,
        uploadedAt
      })

      // Step 3: Create uploaded file record
      const uploadedFile: UploadedFile = {
        filename,
        originalName: originalFilename,
        contentType,
        fileSize,
        uploadedAt: new Date().toISOString()
      }

      uploadedFiles.value.push(uploadedFile)
      uploadProgress.value = 100

      return uploadedFile
    } catch (err: any) {
      error.value = {
        message: err.message,
        code: 'UPLOAD_FAILED',
        details: err
      }
      throw err
    } finally {
      uploading.value = false
    }
  }

  // Upload multiple files
  const uploadFiles = async (files: File[]): Promise<UploadedFile[]> => {
    const results: UploadedFile[] = []
    
    for (const file of files) {
      try {
        const result = await uploadFile(file)
        results.push(result)
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err)
        // Continue with other files
      }
    }
    
    return results
  }

  // Clear uploaded files
  const clearUploadedFiles = () => {
    uploadedFiles.value = []
    error.value = null
    uploadProgress.value = 0
  }

  return {
    // State
    uploading: readonly(uploading),
    uploadProgress: readonly(uploadProgress),
    uploadedFiles: readonly(uploadedFiles),
    error: readonly(error),
    
    // Methods
    uploadFile,
    uploadFiles,
    validateFile,
    clearUploadedFiles
  }
}
```

#### 3. Upload Component

Create `components/FileUpload.vue`:

```vue
<template>
  <div class="file-upload">
    <!-- Upload Area -->
    <div 
      class="upload-area"
      :class="{ 'uploading': uploading, 'drag-over': isDragOver }"
      @drop="handleDrop"
      @dragover.prevent="isDragOver = true"
      @dragleave="isDragOver = false"
    >
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        @change="handleFileSelect"
        class="hidden"
      />
      
      <div v-if="!uploading" class="upload-content">
        <Icon name="upload" class="upload-icon" />
        <p class="upload-text">
          Drag and drop images here, or 
          <button @click="$refs.fileInput.click()" class="upload-button">
            browse files
          </button>
        </p>
        <p class="upload-hint">Supports: JPG, PNG, GIF, WebP (max 10MB each)</p>
      </div>
      
      <div v-else class="upload-progress">
        <Icon name="loading" class="spinning" />
        <p>Uploading... {{ uploadProgress }}%</p>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${uploadProgress}%` }"></div>
        </div>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error-message">
      <Icon name="error" />
      <span>{{ error.message }}</span>
    </div>

    <!-- Uploaded Files -->
    <div v-if="uploadedFiles.length > 0" class="uploaded-files">
      <h3>Uploaded Files ({{ uploadedFiles.length }})</h3>
      <div class="file-list">
        <div 
          v-for="file in uploadedFiles" 
          :key="file.filename"
          class="file-item"
        >
          <div class="file-preview">
            <img 
              :src="getFilePreviewUrl(file)" 
              :alt="file.originalName"
              class="preview-image"
            />
          </div>
          <div class="file-info">
            <p class="file-name">{{ file.originalName }}</p>
            <p class="file-details">
              {{ formatFileSize(file.fileSize) }} • {{ file.contentType }}
            </p>
            <p class="file-date">
              Uploaded {{ formatDate(file.uploadedAt) }}
            </p>
          </div>
          <div class="file-actions">
            <button @click="copyFileUrl(file)" class="action-button">
              <Icon name="copy" />
            </button>
            <button @click="downloadFile(file)" class="action-button">
              <Icon name="download" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div v-if="uploadedFiles.length > 0" class="upload-actions">
      <button @click="clearUploadedFiles" class="clear-button">
        Clear All
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { UploadedFile } from '~/types/upload'

// Props
interface Props {
  maxFiles?: number
  autoUpload?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  maxFiles: 10,
  autoUpload: true
})

// Emits
const emit = defineEmits<{
  upload: [files: UploadedFile[]]
  error: [error: Error]
}>()

// Composables
const { uploadFile, uploadFiles, uploading, uploadProgress, uploadedFiles, error, clearUploadedFiles } = useFileUpload()

// State
const isDragOver = ref(false)
const fileInput = ref<HTMLInputElement>()

// Methods
const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files || [])
  await processFiles(files)
}

const handleDrop = async (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = false
  
  const files = Array.from(event.dataTransfer?.files || [])
  await processFiles(files)
}

const processFiles = async (files: File[]) => {
  if (files.length === 0) return
  
  // Limit number of files
  const filesToProcess = files.slice(0, props.maxFiles)
  
  try {
    const results = await uploadFiles(filesToProcess)
    emit('upload', results)
  } catch (err) {
    emit('error', err as Error)
  }
}

const getFilePreviewUrl = (file: UploadedFile): string => {
  // Return a preview URL - you might want to implement image resizing
  return `https://your-cdn-domain.com/${file.filename}`
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString()
}

const copyFileUrl = async (file: UploadedFile) => {
  const url = getFilePreviewUrl(file)
  await navigator.clipboard.writeText(url)
  // Show toast notification
}

const downloadFile = (file: UploadedFile) => {
  const url = getFilePreviewUrl(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.originalName
  link.click()
}
</script>

<style scoped>
.file-upload {
  @apply w-full max-w-4xl mx-auto p-6;
}

.upload-area {
  @apply border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors;
}

.upload-area.uploading {
  @apply border-blue-500 bg-blue-50;
}

.upload-area.drag-over {
  @apply border-blue-500 bg-blue-50;
}

.upload-content {
  @apply space-y-4;
}

.upload-icon {
  @apply w-12 h-12 mx-auto text-gray-400;
}

.upload-text {
  @apply text-lg text-gray-600;
}

.upload-button {
  @apply text-blue-600 hover:text-blue-800 underline;
}

.upload-hint {
  @apply text-sm text-gray-500;
}

.upload-progress {
  @apply space-y-4;
}

.progress-bar {
  @apply w-full bg-gray-200 rounded-full h-2;
}

.progress-fill {
  @apply bg-blue-600 h-2 rounded-full transition-all duration-300;
}

.error-message {
  @apply flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700;
}

.uploaded-files {
  @apply mt-8;
}

.file-list {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4;
}

.file-item {
  @apply border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow;
}

.file-preview {
  @apply mb-3;
}

.preview-image {
  @apply w-full h-32 object-cover rounded;
}

.file-info {
  @apply space-y-1;
}

.file-name {
  @apply font-medium text-gray-900 truncate;
}

.file-details {
  @apply text-sm text-gray-500;
}

.file-date {
  @apply text-xs text-gray-400;
}

.file-actions {
  @apply flex gap-2 mt-3;
}

.action-button {
  @apply p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded;
}

.upload-actions {
  @apply mt-6 flex justify-end;
}

.clear-button {
  @apply px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded;
}

.spinning {
  @apply animate-spin;
}
</style>
```

#### 4. Usage in Pages

Example usage in `pages/upload.vue`:

```vue
<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-8">Upload Images</h1>
    
    <FileUpload 
      :max-files="5"
      @upload="handleUploadSuccess"
      @error="handleUploadError"
    />
  </div>
</template>

<script setup lang="ts">
import type { UploadedFile } from '~/types/upload'

// Handle successful uploads
const handleUploadSuccess = (files: UploadedFile[]) => {
  console.log('Successfully uploaded files:', files)
  
  // Show success notification
  useToast().add({
    title: 'Upload Successful',
    description: `${files.length} file(s) uploaded successfully`,
    color: 'green'
  })
  
  // Redirect or update UI
  // await navigateTo('/gallery')
}

// Handle upload errors
const handleUploadError = (error: Error) => {
  console.error('Upload error:', error)
  
  // Show error notification
  useToast().add({
    title: 'Upload Failed',
    description: error.message,
    color: 'red'
  })
}

// SEO
useHead({
  title: 'Upload Images',
  meta: [
    { name: 'description', content: 'Upload and manage your images' }
  ]
})
</script>
```

#### 5. API Configuration

Create `plugins/api.client.ts`:

```typescript
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  
  // Configure $fetch defaults
  const $fetch = $fetch.create({
    baseURL: config.public.apiBase || 'https://your-hono-api.workers.dev',
    credentials: 'include',
    onRequest({ request, options }) {
      // Add any default headers
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/json'
      }
    },
    onResponseError({ response }) {
      // Handle common errors
      if (response.status === 401) {
        // Redirect to login
        navigateTo('/login')
      }
    }
  })
  
  return {
    provide: {
      api: $fetch
    }
  }
})
```

#### 6. Environment Configuration

Update `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  // ... other config
  
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'https://your-hono-api.workers.dev'
    }
  },
  
  // Enable CORS for API calls
  nitro: {
    routeRules: {
      '/api/**': { cors: true }
    }
  }
})
```

### React Implementation (Alternative)

For React applications, here's a simplified version:

```typescript
// hooks/useFileUpload.ts
import { useState, useCallback } from 'react'

interface UploadResponse {
  presignedUrl: string
  filename: string
  originalFilename: string
  contentType: string
  fileSize: number
  expiresIn: number
}

export const useFileUpload = () => {
  const [uploading, setUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)

    try {
      // Get pre-signed URL
      const response = await fetch('/api/uploads/pre-signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          fileSize: file.size
        })
      })

      if (!response.ok) throw new Error('Failed to get pre-signed URL')

      const { presignedUrl, filename } = await response.json()

      // Upload to R2 with metadata headers
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 
          'Content-Type': file.type,
          'x-amz-meta-original-filename': response.originalFilename,
          'x-amz-meta-uploaded-by': response.uploadedBy,
          'x-amz-meta-uploaded-at': response.uploadedAt
        },
        body: file
      })

      if (!uploadResponse.ok) throw new Error('Upload failed')

      setUploadedFiles(prev => [...prev, { filename, originalName: file.name }])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }, [])

  return { uploadFile, uploading, uploadedFiles, error }
}
```

## File Storage Details

- **Filename Generation**: Uses `crypto.randomUUID()` + file extension
- **Metadata Storage**: Original filename stored in R2 object metadata
- **File Size Limit**: 10MB per file
- **Supported Types**: All image MIME types (`image/*`)
- **URL Expiration**: 24 hours (86400 seconds)
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
2. **CORS errors**: Ensure CORS policy is properly configured with explicit headers (not wildcards)
3. **403 Forbidden errors**: Check that all metadata headers match between signed request and frontend upload
4. **Authentication errors**: Verify Better Auth session is working
5. **Upload failures**: Check R2 API credentials and bucket permissions
6. **Signature mismatch**: Ensure frontend sends exact same headers that were signed in the pre-signed URL

### Debugging

Enable debug logging by checking the Cloudflare Workers logs:

```bash
npx wrangler tail
```

### Recent Fixes Applied

**CORS Configuration Fix (Critical)**:
- **Problem**: Using `"headers": ["*"]` wildcards in CORS policy caused 403 errors
- **Solution**: Specify exact headers: `["content-type", "x-amz-meta-original-filename", "x-amz-meta-uploaded-at", "x-amz-meta-uploaded-by"]`
- **Why**: Cloudflare R2 doesn't support wildcard headers like AWS S3

**Metadata Headers Fix**:
- **Problem**: Frontend wasn't sending metadata headers that matched the signed request
- **Solution**: Frontend must send exact same headers that were signed in the pre-signed URL
- **Required Headers**: `Content-Type`, `x-amz-meta-original-filename`, `x-amz-meta-uploaded-by`, `x-amz-meta-uploaded-at`

**Expiration Time**:
- **Default**: Pre-signed URLs now expire after 24 hours (86400 seconds)
- **Reason**: Provides more time for uploads while maintaining security

## Next Steps

- Implement file listing/deletion endpoints
- Add image resizing/optimization
- Set up CDN for faster file delivery
- Add file access controls and sharing
