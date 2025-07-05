#!/bin/bash

# Beta Testing Platform Startup Script
echo "🧪 Starting Beta Testing Platform..."

# Navigate to server directory
cd server

# Start the beta server in the background
nohup tsx betaIndex.ts > ../logs/beta-server.log 2>&1 &

# Get the process ID
BETA_PID=$!

# Save the PID for later cleanup
echo $BETA_PID > ../logs/beta-server.pid

echo "🚀 Beta Testing Platform started with PID: $BETA_PID"
echo "📋 Logs available at: logs/beta-server.log"
echo "🌐 Server running on: http://localhost:3001"

# Wait a moment to ensure server starts
sleep 3

# Test the server
if curl -s http://localhost:3001/api/beta/health > /dev/null; then
    echo "✅ Beta server is running and responding"
else
    echo "❌ Beta server failed to start"
    exit 1
fi