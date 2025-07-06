
const { spawn } = require('child_process');
const axios = require('axios');

async function testBetaServer() {
  console.log('🧪 Testing beta server startup...');
  
  // Kill any existing processes
  const { exec } = require('child_process');
  await new Promise(resolve => {
    exec('pkill -f "betaIndex.ts" || true', () => resolve());
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Start the server
  const server = spawn('npx', ['tsx', 'server/betaIndex.ts'], {
    stdio: 'pipe',
    cwd: process.cwd()
  });
  
  server.stdout.on('data', (data) => {
    console.log(`[Beta] ${data.toString().trim()}`);
  });
  
  server.stderr.on('data', (data) => {
    console.error(`[Beta Error] ${data.toString().trim()}`);
  });
  
  // Wait and test
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    const response = await axios.get('http://0.0.0.0:3001/api/beta/health');
    console.log('✅ Beta server health check passed:', response.data);
  } catch (error) {
    console.error('❌ Beta server health check failed:', error.message);
  }
  
  // Clean up
  server.kill();
  process.exit(0);
}

testBetaServer().catch(console.error);
