# Vercel Deployment Guide for VibeSnipe

## Quick Start

### Step 1: Install Vercel CLI
```bash
npm i -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```
This will open a browser window for you to authenticate.

### Step 3: Deploy (Preview First)
```bash
vercel
```
This creates a preview deployment you can test before going to production.

### Step 4: Deploy to Production
```bash
vercel --prod
```

## Configuration

Your `vercel.json` is already configured with:
- Build command: `npm run build`
- Output directory: `.next`
- Framework: Next.js (auto-detected)
- Install command: `npm install`

## Environment Variables

After deployment, set environment variables in Vercel dashboard:

1. Go to your project in Vercel dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add variables from `.env.example`:
   - `NEXT_PUBLIC_APP_NAME` (optional, defaults to VibeSnipe)
   - `NEXT_PUBLIC_APP_ENV` (set to `production`)

**Note**: Currently no API credentials needed since we're using mocked APIs.

## Deployment Process

### First Deployment
1. Run `vercel` - this will ask you questions:
   - **Set up and deploy?** → Yes
   - **Which scope?** → Your account or team
   - **Link to existing project?** → No (first time)
   - **Project name?** → vibesnipe (or press Enter for default)
   - **Directory?** → . (current directory)
   - **Override settings?** → No (uses vercel.json)

2. Vercel will build and deploy your app
3. You'll get a preview URL like `vibesnipe-xyz.vercel.app`

### Production Deployment
1. Once preview looks good, run `vercel --prod`
2. You'll get a production URL like `vibesnipe.vercel.app`

## Custom Domain (Optional)

1. Go to project settings in Vercel dashboard
2. Navigate to **Domains**
3. Add your custom domain
4. Configure DNS records as instructed
5. SSL is automatically provisioned

## Monitoring

After deployment:
1. Check the deployment logs for any errors
2. Visit the preview/production URL
3. Use `POST_DEPLOYMENT_CHECKLIST.md` to verify everything works

## Troubleshooting

### Build Fails
- Check deployment logs in Vercel dashboard
- Verify Node.js version (Vercel uses 18+ by default)
- Ensure all dependencies are in `package.json`

### Environment Variables Not Working
- Make sure variables are set in Vercel dashboard
- Redeploy after adding variables
- Check variable names match (case-sensitive)

### Deployment Stuck
- Cancel and retry
- Check Vercel status page
- Verify build works locally first

## Next Steps After Deployment

1. ✅ Test the deployed app
2. ✅ Set up monitoring (optional)
3. ✅ Configure custom domain (optional)
4. ✅ Set up CI/CD for automatic deployments (optional)

## Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js on Vercel](https://vercel.com/docs/concepts/nextjs/overview)
- Your deployment: Check Vercel dashboard for project URL

