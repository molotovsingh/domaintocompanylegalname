#!/bin/bash

# Kill any existing beta server processes
pkill -f "betaIndex.ts" 2>/dev/null || true

# Wait for processes to terminate
sleep 1

# Start the beta server
cd /home/runner/workspace
echo "Starting beta server..."
npx tsx server/betaIndex.ts