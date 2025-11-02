# Quick Start: Production Deployment Script

## 🚀 One-Command Deployment

### Deploy to Vercel (Production)

```bash
npm run deploy:prod
```

### Deploy to Netlify (Production)

```bash
npm run deploy:netlify:prod
```

## 📋 What the Script Does

The deployment script automatically:

1. ✅ Checks Node.js and npm versions
2. ✅ Verifies git status
3. ✅ Installs dependencies (`npm ci`)
4. ✅ Runs linting checks
5. ✅ Runs TypeScript type checking
6. ✅ Builds the application (`npm run build`)
7. ✅ Deploys to your chosen platform (Vercel/Netlify)

## 🎯 Available Commands

```bash
# Vercel deployment (preview)
npm run deploy

# Vercel deployment (production)
npm run deploy:prod

# Netlify deployment (draft)
npm run deploy:netlify

# Netlify deployment (production)
npm run deploy:netlify:prod

# Direct script usage
node scripts/deploy.js --help
```

## ⚠️ First Time Setup

### Vercel

```bash
# Install and login (one-time)
npm i -g vercel
vercel login
```

### Netlify

```bash
# Install and login (one-time)
npm i -g netlify-cli
netlify login
```

## 🔧 Troubleshooting

### Authentication Issues

If deployment fails with permission errors, ensure you're logged in:

```bash
# Vercel
vercel login

# Netlify
netlify login
```

### Build Fails

```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm ci
npm run build
```

### Skip Checks (Emergency Only)

```bash
node scripts/deploy.js --skip-checks --prod
```

⚠️ **Warning**: Only use `--skip-checks` if you're absolutely certain your code is ready.

## 📚 More Information

- See `scripts/DEPLOYMENT_README.md` for detailed documentation
- See `DEPLOYMENT.md` for full deployment guide
- See `POST_DEPLOYMENT_CHECKLIST.md` for post-deployment steps

---

**Ready to deploy?** Run `npm run deploy:prod` and follow the prompts! 🚀

