# Deploy to Vercel - Quick Guide

## Option 1: Deploy via CLI (Recommended)

### Step 1: Login to Vercel
```bash
vercel login
```
This will open a browser for authentication.

### Step 2: Deploy (Preview First)
```bash
vercel
```

When prompted:
- **Set up and deploy?** → Yes
- **Which scope?** → Your account
- **Link to existing project?** → No (first time)
- **Project name?** → vibesnipe (or press Enter)
- **Directory?** → . (current directory - press Enter)
- **Override settings?** → No (uses vercel.json)

This creates a **preview deployment** you can test first.

### Step 3: Deploy to Production
Once preview looks good:
```bash
vercel --prod
```

This deploys to your production domain.

## Option 2: Deploy via GitHub + Vercel Dashboard

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Step 2: Deploy via Vercel Dashboard
1. Go to https://vercel.com
2. Sign in with GitHub
3. Click "Add New..." → "Project"
4. Import your GitHub repository
5. Click "Deploy"

## After Deployment

Your app will be available at:
- Preview: `vibesnipe-xyz.vercel.app`
- Production: `vibesnipe.vercel.app` (or your custom domain)

## Environment Variables (Optional)

If you need environment variables later:
1. Go to Vercel dashboard → Your Project → Settings → Environment Variables
2. Add any required variables
3. Redeploy

**Note**: Currently no environment variables are required - the app works with mocked APIs.

## Verify Deployment

After deployment, check:
- ✅ All views load correctly (Home, Create Trade, History, Settings, Library)
- ✅ Theme switching works (Dark/Light/Auto)
- ✅ Navigation works
- ✅ No console errors

## Troubleshooting

### Build fails
- Check deployment logs in Vercel dashboard
- Ensure `npm run build` works locally first

### App not loading
- Check browser console for errors
- Verify all dynamic imports are working
- Check Vercel deployment logs

### Need to redeploy
Just run `vercel --prod` again after making changes.

