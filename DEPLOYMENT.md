# VibeSnipe Deployment Guide

This guide walks you through deploying VibeSnipe to production.

## Prerequisites

- ✅ Code builds successfully: `npm run build`
- ✅ All tests pass (if any): `npm test`
- ✅ No linting errors: `npm run lint`
- ✅ TypeScript compiles: `npx tsc --noEmit`
- ✅ Environment variables documented in `.env.example`

## Pre-Deployment Checklist

- [ ] Build succeeds locally: `npm run build`
- [ ] Application runs locally: `npm start`
- [ ] All environment variables documented
- [ ] README.md updated with deployment instructions
- [ ] Dependencies are up to date

## Deployment Options

### Option 1: Vercel (Recommended)

Vercel is the recommended platform for Next.js applications. It provides:
- Automatic HTTPS
- Global CDN
- Preview deployments
- Environment variable management
- Zero-config deployments

#### Setup Steps

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy to Preview**:
   ```bash
   vercel
   ```
   This creates a preview deployment you can test before going live.

4. **Configure Environment Variables**:
   - Go to your Vercel project dashboard
   - Navigate to Settings → Environment Variables
   - Add all variables from `.env.example`
   - Set them for Production, Preview, and Development environments

5. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

6. **Configure Custom Domain** (Optional):
   - Go to Settings → Domains
   - Add your custom domain
   - Configure DNS records as instructed
   - SSL is automatically provisioned

#### Vercel Build Settings

Vercel auto-detects Next.js and configures:
- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`
- **Node Version**: Latest LTS (automatic)

No additional configuration needed!

### Option 2: Netlify

Netlify also supports Next.js with minimal configuration.

#### Setup Steps

1. **Install Netlify CLI**:
   ```bash
   npm i -g netlify-cli
   ```

2. **Create `netlify.toml`**:
   ```toml
   [build]
     command = "npm run build"
     publish = ".next"
   
   [[plugins]]
     package = "@netlify/plugin-nextjs"
   ```

3. **Login to Netlify**:
   ```bash
   netlify login
   ```

4. **Initialize Site**:
   ```bash
   netlify init
   ```

5. **Deploy**:
   ```bash
   netlify deploy --prod
   ```

6. **Configure Environment Variables**:
   - Go to Site Settings → Environment Variables
   - Add variables from `.env.example`

### Option 3: Custom Server

For deployment on your own server or VPS.

#### Requirements

- Node.js 18+ installed
- PM2 or similar process manager (recommended)
- Reverse proxy (nginx/Caddy) for HTTPS
- Domain with DNS configured

#### Setup Steps

1. **Build the Application**:
   ```bash
   npm run build
   ```

2. **Set Environment Variables**:
   Create a `.env.production` file or set system environment variables:
   ```bash
   export NEXT_PUBLIC_APP_ENV=production
   export NEXT_PUBLIC_APP_NAME=VibeSnipe
   # Add other variables as needed
   ```

3. **Start with PM2**:
   ```bash
   npm install -g pm2
   pm2 start npm --name "vibesnipe" -- start
   pm2 save
   pm2 startup  # Set up PM2 to start on system boot
   ```

4. **Configure Reverse Proxy** (nginx example):
   ```nginx
   server {
     listen 80;
     server_name yourdomain.com;
     
     location / {
       proxy_pass http://localhost:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
     }
   }
   ```

5. **Set up SSL** (using Let's Encrypt with Certbot):
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

## Environment Variables

### Required for Production

Currently, no API credentials are required since the app uses mocked APIs. However, if you plan to integrate real APIs, set:

- `TASTYTRADE_USERNAME` - Your Tastytrade username
- `TASTYTRADE_PASSWORD` - Your Tastytrade password  
- `TASTYTRADE_ENV` - `sandbox` or `live`
- `QUOTE_FEED_URL` - WebSocket URL for quotes
- `QUOTE_FEED_API_KEY` - API key for quote feed

### Application Settings

- `NEXT_PUBLIC_APP_NAME` - Application name (default: VibeSnipe)
- `NEXT_PUBLIC_APP_ENV` - `development` or `production`

**Important**: Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Never put secrets in these variables.

## Post-Deployment Verification

### 1. Functional Testing

- [ ] Application loads without errors
- [ ] Theme switching works (Light/Dark/Auto)
- [ ] Trade entry flows work (Discord, Preset, Manual)
- [ ] Order preview displays correctly
- [ ] Risk graph renders
- [ ] Day HUD shows countdown
- [ ] Positions panel loads

### 2. Performance Testing

- [ ] Lighthouse score > 80 for Performance
- [ ] First Contentful Paint < 2s
- [ ] Time to Interactive < 3s
- [ ] Bundle size is reasonable

### 3. Mobile Testing

- [ ] Responsive design works on mobile
- [ ] Touch interactions work
- [ ] Layout doesn't break on small screens

### 4. Browser Compatibility

- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)

## Monitoring & Maintenance

### Error Tracking

Consider setting up error tracking:
- **Sentry**: `npm install @sentry/nextjs`
- **LogRocket**: `npm install logrocket`
- **Vercel Analytics**: Built-in with Vercel

### Analytics

- **Vercel Analytics**: Automatic with Vercel Pro
- **Google Analytics**: Add via `_document.tsx` or `_app.tsx`
- **Plausible**: Privacy-focused analytics

### Performance Monitoring

- **Vercel Speed Insights**: Built-in with Vercel
- **Lighthouse CI**: Automated performance testing
- **WebPageTest**: Manual performance testing

## Rollback Procedures

### Vercel

1. Go to Deployments in Vercel dashboard
2. Find the previous working deployment
3. Click "..." menu → "Promote to Production"

### Netlify

1. Go to Deploy log in Netlify dashboard
2. Find previous deployment
3. Click "Publish deploy"

### Custom Server

1. Checkout previous git commit
2. Rebuild: `npm run build`
3. Restart PM2: `pm2 restart vibesnipe`

## Troubleshooting

### Build Fails

- Check Node.js version (requires 18+)
- Clear `.next` folder and rebuild
- Check for TypeScript errors: `npx tsc --noEmit`
- Verify all dependencies installed: `npm install`

### Deployment Fails

- Check environment variables are set correctly
- Verify build command works locally
- Check deployment logs for specific errors
- Ensure all required dependencies are in `package.json`

### Application Errors

- Check browser console for client-side errors
- Check server logs for server-side errors
- Verify all environment variables are set
- Check API endpoints if using real APIs

### Performance Issues

- Check bundle size (should be < 5MB total)
- Verify Plotly.js is properly code-split
- Check for memory leaks in components
- Verify CDN is serving static assets

## CI/CD Setup (Optional)

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

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
      - run: npm run lint
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

## Support

For issues or questions:
1. Check the README.md
2. Review TASKS.md for known issues
3. Check deployment platform documentation
4. Review error logs

## Next Steps

After successful deployment:
1. Set up monitoring and error tracking
2. Configure custom domain (if desired)
3. Set up automated deployments via CI/CD
4. Integrate real APIs when ready
5. Set up analytics if needed

