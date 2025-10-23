const fs = require('fs');
const { execSync } = require('child_process');

// Ensure test-results directory exists at repo root
const resultsDir = `${__dirname}/..` + '/../test-results';
if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

// Run seeder
console.log('Running e2e seeder...');
try {
  execSync('node ./setup/seed.js', { stdio: 'inherit' });
} catch (err) {
  console.warn('Seeder failed (continuing):', err.message);
}

console.log('Preparation complete');
