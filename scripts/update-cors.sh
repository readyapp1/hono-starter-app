#!/bin/bash

# CORS Update Script for Gallery Bucket
# Usage: ./scripts/update-cors.sh [domain1] [domain2] ...
# Example: ./scripts/update-cors.sh "https://myapp.com" "https://www.myapp.com"

echo "🌐 Updating CORS policy for gallery bucket..."

# Default to wildcard if no domains provided
if [ $# -eq 0 ]; then
    ALLOWED_ORIGINS='["*"]'
    echo "⚠️  No domains specified, using wildcard (*) - not recommended for production!"
else
    # Build array of domains
    ALLOWED_ORIGINS="["
    for domain in "$@"; do
        ALLOWED_ORIGINS="$ALLOWED_ORIGINS\"$domain\","
    done
    # Remove trailing comma and close array
    ALLOWED_ORIGINS="${ALLOWED_ORIGINS%,}]"
    echo "✅ Restricting to domains: $ALLOWED_ORIGINS"
fi

# Create CORS configuration
cat > cors.json << EOF
{
  "rules": [
    {
      "allowed": {
        "methods": ["PUT", "GET", "POST","DELETE"],
        "origins": $ALLOWED_ORIGINS,
        "headers": ["Content-Type", "Authorization"]
      },
      "exposeHeaders": ["ETag"],
      "maxAgeSeconds": 3000
    }
  ]
}
EOF

echo "📝 CORS configuration:"
cat cors.json

# Apply CORS policy
echo "🚀 Applying CORS policy..."
npx wrangler r2 bucket cors set gallery --file=cors.json

if [ $? -eq 0 ]; then
    echo "✅ CORS policy updated successfully!"
else
    echo "❌ Failed to update CORS policy"
fi

# Clean up
rm -f cors.json

echo ""
echo "💡 To update CORS again, run:"
echo "   ./scripts/update-cors.sh \"https://yourdomain.com\" \"https://www.yourdomain.com\""
