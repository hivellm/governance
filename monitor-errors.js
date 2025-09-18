/**
 * Error Monitor for BIP-06 Web Interface
 * Monitors server logs and captures frontend errors
 */

const { spawn } = require('child_process');
const fs = require('fs');

console.log('🔍 Iniciando monitoramento de erros do BIP-06...\n');

// Monitor NestJS logs
const nestProcess = spawn('npm', ['run', 'start:dev'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe']
});

let errorCount = 0;
let lastErrors = [];

function logError(source, error) {
  errorCount++;
  const timestamp = new Date().toISOString();
  const errorInfo = {
    timestamp,
    source,
    error: error.toString(),
    count: errorCount
  };
  
  lastErrors.push(errorInfo);
  if (lastErrors.length > 10) {
    lastErrors.shift(); // Keep only last 10 errors
  }
  
  console.log(`\n❌ [${timestamp}] ${source}:`);
  console.log(`   ${error}`);
  console.log(`   Total errors: ${errorCount}\n`);
}

// Monitor stdout for compilation errors
nestProcess.stdout.on('data', (data) => {
  const output = data.toString();
  
  // Check for compilation errors
  if (output.includes('error TS')) {
    logError('TypeScript Compilation', output.trim());
  }
  
  // Check for runtime errors
  if (output.includes('ERROR') || output.includes('Exception')) {
    logError('Runtime Error', output.trim());
  }
  
  // Show successful startup
  if (output.includes('started successfully')) {
    console.log('✅ Servidor iniciado com sucesso!');
    console.log('🌐 Interface: http://localhost:23080/dashboard');
    console.log('📊 API Docs: http://localhost:23080/api');
    console.log('\n📋 Pronto para testar - monitorando erros...\n');
  }
});

// Monitor stderr for errors
nestProcess.stderr.on('data', (data) => {
  const error = data.toString();
  if (error.trim()) {
    logError('Server Error', error.trim());
  }
});

// Handle process exit
nestProcess.on('close', (code) => {
  console.log(`\n🔴 Servidor parou com código: ${code}`);
  if (errorCount > 0) {
    console.log(`\n📊 Resumo de erros (${errorCount} total):`);
    lastErrors.forEach((err, index) => {
      console.log(`${index + 1}. [${err.timestamp}] ${err.source}: ${err.error.substring(0, 100)}...`);
    });
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Parando monitoramento...');
  nestProcess.kill();
  process.exit(0);
});

// Keep alive
setInterval(() => {
  // Check if server is responding
  const http = require('http');
  const req = http.get('http://localhost:23080/', (res) => {
    if (res.statusCode !== 200) {
      logError('HTTP Error', `Status ${res.statusCode}: ${res.statusMessage}`);
    }
  });
  
  req.on('error', (err) => {
    logError('Connection Error', err.message);
  });
  
  req.setTimeout(5000, () => {
    req.destroy();
    logError('Timeout Error', 'Server não respondeu em 5 segundos');
  });
}, 30000); // Check every 30 seconds

console.log('📡 Monitoramento ativo - pressione Ctrl+C para parar\n');
