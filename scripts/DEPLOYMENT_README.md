# Deployment Scripts

This directory contains production deployment scripts for VibeSnipe.

## Quick Start

### Using npm scripts (Recommended)

```bash
# Deploy to Vercel (preview)
npm run deploy

# Deploy to Vercel production
npm run deploy:prod

# Deploy to Netlify (draft)
npm run deploy:netlify

# Deploy to Netlify production
npm run deploy:netlify:prod
```

### Using Node.js script directly

```bash
# Preview deployment to Vercel
node scripts/deploy.js

# Production deployment to Vercel
node scripts/deploy.js --vercel --prod

# Preview deployment to Netlify
node scripts/deploy.js --netlify

# Production deployment to Netlify
node scripts/deploy.js --netlify --prod

# Skip pre-deployment checks (use with caution)
node scripts/deploy.js --skip-checks --prod
```

### Using Bash script (macOS/Linux)

```bash
# Preview deployment to Vercel
./scripts/deploy.sh

# Production deployment to Vercel
./scripts/deploy.sh --vercel

# Deployment to Netlify
./scripts/deploy.sh --netlify
```

## What the Scripts Do

The deployment scripts automatically handle:

1. **Pre-Deployment Checks**
   - Verify Node.js and npm versions
   - Check git status (warns about uncommitted changes)
   - Verify you're in the project root

2. **Dependency Management**
   - Install dependencies with `npm ci`
   - Verify dependencies are up to date

3. **Code Quality Checks**
   - Run linting (`npm run lint`)
   - Run TypeScript type checking (`npx tsc --noEmit`)

4. **Build Process**
   - Run production build (`npm run build`)
   - Verify build output exists (`.next` directory)

5. **Deployment**
   - Deploy to your chosen platform (Vercel or Netlify)
   - Handle CLI installation if needed
   - Provide deployment URLs

## Options

### Command Line Options

- `--vercel` - Deploy to Vercel (default)
- `--netlify` - Deploy to Netlify
- `--prod` / `--production` - Deploy to production (vs preview/draft)
- `--skip-checks` - Skip pre-deployment checks (use with caution)
- `--help` - Show help message

### Examples

```bash
# Deploy to Vercel production
npm run deploy:vercel:prod

# Deploy to Netlify preview
npm run deploy:netlify

# Quick deploy (skip checks)
node scripts/deploy.js --skip-checks --prod

# Show help
node scripts/deploy.js --help
```

## Prerequisites

### Vercel Deployment

1. Install Vercel CLI (script will auto-install if missing):
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel (first time only):
   ```bash
   vercel login
   ```

3. Ensure `vercel.json` is configured (already done)

### Netlify Deployment

1. Install Netlify CLI (script will auto-install if missing):
   ```bash
   npm i -g netlify-cli
   ```

2. Login to Netlify (first time only):
   ```bash
   netlify login
   ```

3. Ensure `netlify.toml` is configured (already done)

## Environment Variables

Set environment variables in your deployment platform dashboard:

### Vercel
1. Go to your project in Vercel dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add variables as needed

### Netlify
1. Go to your site in Netlify dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Add variables as needed

## Troubleshooting

### Build Fails

1. **Check Node.js version**: VibeSnipe requires Node.js 18+
   ```bash
   node -v
   ```

2. **Clear build cache**:
   ```bash
   rm -rf .next
   npm run build
   ```

3. **Check for TypeScript errors**:
   ```bash
   npx tsc --noEmit
   ```

### Lint Errors

Fix linting errors before deploying:
```bash
npm run lint
```

Or use `--skip-checks` only if you're absolutely sure:
```bash
npm run deploy --skip-checks --prod
```

### Deployment Platform Issues

**Vercel**:
- Check deployment logs in Vercel dashboard
- Verify `vercel.json` configuration
- Ensure Node.js version is compatible

**Netlify**:
- Check build logs in Netlify dashboard
- Verify `netlify.toml` configuration
- Check Node.js version (should be 18+)

### Authentication Issues

If deployment fails with authentication errors:

**Vercel**:
```bash
vercel login
vercel link  # Link to existing project
```

**Netlify**:
```bash
netlify login
netlify link  # Link to existing site
```

## Post-Deployment

After successful deployment:

1. ✅ Test the deployed application
2. ✅ Check `POST_DEPLOYMENT_CHECKLIST.md`
3. ✅ Monitor error logs in your deployment platform
4. ✅ Set up environment variables if needed
5. ✅ Configure custom domain (optional)

## CI/CD Integration

For automated deployments, integrate these scripts into your CI/CD pipeline:

### GitHub Actions Example

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm run deploy:prod
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

### GitLab CI Example

```yaml
deploy:
  stage: deploy
  script:
    - npm ci
    - npm run build
    - npm run deploy:prod
  only:
    - main
```

## Manual Deployment

If you prefer to deploy manually:

1. **Build locally**:
   ```bash
   npm run build
   ```

2. **Test locally**:
   ```bash
   npm start
   ```

3. **Deploy**:
   ```bash
   # Vercel
   vercel --prod
   
   # Netlify
   netlify deploy --prod
   ```

## Support

For issues or questions:
- Check `DEPLOYMENT.md` for detailed deployment guide
- Check `VERCEL_DEPLOYMENT.md` for Vercel-specific instructions
- Check `POST_DEPLOYMENT_CHECKLIST.md` for post-deployment steps

