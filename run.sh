#!/bin/bash

# Exit if any command fails
set -e

#!/bin/bash

echo "🔄 Generating Prisma Client..."
npx prisma generate

echo "📊 Applying pending migrations (safe - won't delete data)..."
npx prisma migrate deploy  # ✅ Safe - only applies pending migrations, doesn't reset

echo "✅ Migrations applied successfully!"

echo "🚀 Starting the application..."
npm run start:dev