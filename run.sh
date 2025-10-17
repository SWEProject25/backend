#!/bin/bash

# Exit if any command fails
set -e

# Generate Prisma client
npx prisma generate

# Reset database (drops and re-applies migrations)
npx prisma migrate reset --force

# Run migrations and generate client again
npx prisma migrate dev

# Start the app in dev mode
npm run start:dev
