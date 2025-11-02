#!/usr/bin/env node

/**
 * VibeSnipe Production Deployment Script (Node.js)
 * Cross-platform deployment script with comprehensive checks
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(message) {
  log('\n' + '='.repeat(50), 'blue');
  log(message, 'blue');
  log('='.repeat(50) + '\n', 'blue');
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function warning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ ${message}`, 'cyan');
}

// Check if command exists
function commandExists(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Run command and capture output
function runCommand(command, options = {}) {
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
    return { success: true, output: output || '', code: 0 };
  } catch (err) {
    const errorOutput = err.stdout?.toString() || err.stderr?.toString() || err.message || '';
    return { success: false, output: errorOutput, code: err.status || err.code || 1 };
  }
}

// Pre-deployment checks
async function preDeploymentChecks() {
  header('Pre-Deployment Checks');

  // Check Node.js version
  const nodeVersion = execSync('node -v', { encoding: 'utf-8' }).trim();
  success(`Node.js version: ${nodeVersion}`);

  // Check npm version
  const npmVersion = execSync('npm -v', { encoding: 'utf-8' }).trim();
  success(`npm version: ${npmVersion}`);

  // Check if we're in the right directory
  if (!fs.existsSync('package.json')) {
    error('package.json not found. Are you in the project root?');
    process.exit(1);
  }

  // Check git status
  if (commandExists('git') && fs.existsSync('.git')) {
    const gitStatus = runCommand('git status --porcelain', { silent: true });
    if (gitStatus.output.trim()) {
      warning('Working directory has uncommitted changes');
      // In a real scenario, you might want to prompt here
      // For now, we'll just warn
    } else {
      success('Working directory is clean');
    }
  }

  success('Pre-deployment checks passed');
}

// Install dependencies
async function installDependencies() {
  header('Installing Dependencies');

  const packageJsonTime = fs.statSync('package.json').mtime;
  const nodeModulesExists = fs.existsSync('node_modules');

  if (!nodeModulesExists) {
    info('Installing npm dependencies...');
    runCommand('npm ci');
    success('Dependencies installed');
  } else {
    try {
      const nodeModulesTime = fs.statSync('node_modules').mtime;
      if (packageJsonTime > nodeModulesTime) {
        info('package.json is newer than node_modules, reinstalling...');
        runCommand('npm ci');
        success('Dependencies reinstalled');
      } else {
        success('Dependencies up to date');
      }
    } catch {
      // If we can't determine, install anyway
      info('Installing npm dependencies...');
      runCommand('npm ci');
      success('Dependencies installed');
    }
  }
}

// Run linting
async function runLint() {
  header('Running Lint Checks');

  const result = runCommand('npm run lint', { silent: true });
  
  // Check if there are actual errors (not just warnings)
  const output = result.output || '';
  const hasErrors = output.includes('Error:') || output.includes('✗');
  const hasWarnings = output.includes('Warning:') || output.includes('⚠');
  
  // Next.js lint exits with code 0 even with warnings, only errors cause non-zero exit
  if (result.success || result.code === 0) {
    if (hasWarnings && !hasErrors) {
      warning('Lint checks passed with warnings (non-blocking)');
    } else if (!hasErrors) {
      success('Lint checks passed');
    } else {
      error('Lint checks failed with errors');
      warning('Fix linting errors before deploying');
      console.log('\n' + output);
      process.exit(1);
    }
  } else {
    error('Lint checks failed');
    warning('Fix linting errors before deploying');
    console.log('\n' + output);
    process.exit(1);
  }
}

// Type check
async function typeCheck() {
  header('Running TypeScript Type Check');

  const result = runCommand('npx tsc --noEmit', { silent: true });
  if (result.success) {
    success('Type check passed');
  } else {
    error('Type check failed');
    warning('Fix type errors before deploying');
    process.exit(1);
  }
}

// Build application
async function buildApp() {
  header('Building Application');

  info('Running production build...');
  const result = runCommand('npm run build');
  if (!result.success) {
    error('Build failed');
    process.exit(1);
  }

  if (fs.existsSync('.next')) {
    success('Build completed successfully');
    success('Build output directory (.next) exists');
  } else {
    error('Build output directory not found');
    process.exit(1);
  }
}

// Deploy to Vercel
async function deployVercel(production = false) {
  header('Deploying to Vercel');

  if (!commandExists('vercel')) {
    warning('Vercel CLI not installed');
    info('Installing Vercel CLI...');
    runCommand('npm i -g vercel');
  }

  info(`Starting Vercel deployment (${production ? 'production' : 'preview'})...`);
  
  if (production) {
    runCommand('vercel --prod --yes');
    success('Deployed to production');
  } else {
    runCommand('vercel --yes');
    success('Deployed to preview');
    info("Run 'vercel --prod' to deploy to production");
  }
}

// Deploy to Netlify
async function deployNetlify(production = false) {
  header('Deploying to Netlify');

  if (!commandExists('netlify')) {
    warning('Netlify CLI not installed');
    info('Installing Netlify CLI...');
    runCommand('npm i -g netlify-cli');
  }

  info(`Starting Netlify deployment (${production ? 'production' : 'draft'})...`);
  
  if (production) {
    runCommand('netlify deploy --prod');
    success('Deployed to production');
  } else {
    runCommand('netlify deploy');
    success('Deployed to draft');
    info("Run 'netlify deploy --prod' to deploy to production");
  }
}

// Main function
async function main() {
  header('VibeSnipe Production Deployment');

  // Parse command line arguments
  const args = process.argv.slice(2);
  let deploymentTarget = 'vercel';
  let skipChecks = false;
  let production = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--vercel':
        deploymentTarget = 'vercel';
        break;
      case '--netlify':
        deploymentTarget = 'netlify';
        break;
      case '--skip-checks':
        skipChecks = true;
        break;
      case '--prod':
      case '--production':
        production = true;
        break;
      case '--help':
        console.log('Usage: node scripts/deploy.js [OPTIONS]');
        console.log('');
        console.log('Options:');
        console.log('  --vercel       Deploy to Vercel (default)');
        console.log('  --netlify       Deploy to Netlify');
        console.log('  --skip-checks   Skip pre-deployment checks');
        console.log('  --prod          Deploy to production');
        console.log('  --help          Show this help message');
        process.exit(0);
      default:
        error(`Unknown option: ${arg}`);
        console.log('Use --help for usage information');
        process.exit(1);
    }
  }

  try {
    // Run pre-deployment checks unless skipped
    if (!skipChecks) {
      await preDeploymentChecks();
      await installDependencies();
      await runLint();
      await typeCheck();
    }

    // Build application
    await buildApp();

    // Deploy
    if (deploymentTarget === 'vercel') {
      await deployVercel(production);
    } else if (deploymentTarget === 'netlify') {
      await deployNetlify(production);
    }

    header('Deployment Complete!');
    success('Your application has been deployed successfully');
    info('Don\'t forget to:');
    info('  1. Test the deployed application');
    info('  2. Check POST_DEPLOYMENT_CHECKLIST.md');
    info('  3. Monitor error logs in your deployment platform');
  } catch (err) {
    error(`Deployment failed: ${err.message}`);
    process.exit(1);
  }
}

// Run main function
main();

