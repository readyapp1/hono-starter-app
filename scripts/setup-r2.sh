#!/bin/bash

# R2 Setup Script for Gallery Bucket
# This script helps set up the R2 bucket and CORS policy for file uploads

echo "🚀 Setting up R2 Gallery Bucket..."

# Check if wrangler is installed
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js and npm first."
    exit 1
fi

# Create the gallery bucket
echo "📦 Creating gallery bucket..."
npx wrangler r2 bucket create gallery

if [ $? -eq 0 ]; then
    echo "✅ Gallery bucket created successfully!"
else
    echo "⚠️  Bucket creation failed. This might be because:"
    echo "   - R2 is not enabled in your Cloudflare account"
    echo "   - The bucket already exists"
    echo "   - You need to run 'npx wrangler login' first"
    echo ""
    echo "Please enable R2 in the Cloudflare Dashboard and try again."
fi

# Create CORS policy file
echo "🔧 Creating CORS policy..."
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

# Apply CORS policy
echo "🌐 Applying CORS policy..."
npx wrangler r2 bucket cors set gallery --file=cors.json

if [ $? -eq 0 ]; then
    echo "✅ CORS policy applied successfully!"
else
    echo "❌ Failed to apply CORS policy"
fi

# Clean up
rm -f cors.json

echo ""
echo "🎉 Setup complete! Next steps:"
echo "1. Create R2 API token in Cloudflare Dashboard"
echo "2. Add environment variables to .dev.vars file:"
echo "   - CLOUDFLARE_ACCOUNT_ID"
echo "   - R2_ACCESS_KEY_ID" 
echo "   - R2_SECRET_ACCESS_KEY"
echo "3. Run 'npm run dev' to test locally"
echo "4. Run 'npm run deploy' to deploy your application"
echo ""
echo "📖 See docs/features/r2-uploads.md for detailed instructions"
