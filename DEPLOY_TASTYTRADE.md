# Tastytrade API Integration - Deployment Checklist

This guide walks you through deploying the Tastytrade API integration to Vercel production.

---

## 1️⃣ Verify Local Build First

Before deploying, make sure everything works locally:

```bash
npm run build
npm run dev
```

**Test the auth endpoint:**
Visit `http://localhost:3000/api/tastytrade/auth`

✅ You should see a JSON response like:
```json
{ 
  "status": "ok", 
  "env": "sandbox", 
  "accountInfo": {
    "accountNumber": "...",
    "accountType": "MARGIN"
  }
}
```

If that works, your integration is functioning locally.

---

## 2️⃣ Commit Your Code

In Cursor's **Source Control panel** (left sidebar):

1. **Stage all changes:**
   - Check all new files under `src/lib/tastytrade/`
   - Check all new files under `src/app/api/tastytrade/`
   - Check updated files: `src/stores/useQuotes.ts`, `src/stores/useOrders.ts`

2. **Commit with message:**
   ```
   feat(tastytrade): add full API integration + quote/stream foundation
   ```

3. **Push to GitHub:**
   ```bash
   git push origin main
   ```
   
   💡 *If Cursor asks which branch — pick `main` (or `prod` if that's your deploy branch).*

---

## 3️⃣ Configure Vercel Environment Variables

1. Log in to [vercel.com](https://vercel.com)
2. Open your **VibeSnipe** project
3. Navigate to **Settings → Environment Variables**

Add these environment variables:

| Name                       | Value                       | Environment | Notes                                    |
| -------------------------- | --------------------------- | ----------- | ---------------------------------------- |
| `TASTYTRADE_ENV`           | `sandbox`                   | All         | Use `prod` when ready for live trading  |
| `TASTYTRADE_CLIENT_SECRET` | Your real client secret     | All         | From Tastytrade OAuth app settings       |
| `TASTYTRADE_REFRESH_TOKEN` | Your real refresh token     | All         | From Tastytrade OAuth app settings       |

⚠️ **Important:**
- Make sure to select **"All Environments"** for each variable
- Click **Save** after adding each variable
- Never commit these values to your repo

---

## 4️⃣ Trigger Deployment

### Option A: Automatic (if repo is linked)
Vercel automatically redeploys on `git push` to your main branch.

### Option B: Manual deployment

From the command line:
```bash
vercel --prod
```

Or from the Vercel dashboard:
→ **Deployments → Redeploy → "Production"**

---

## 5️⃣ Verify Live Endpoints

Once deployed, test your live endpoints:

### Auth Endpoint
```bash
curl https://<your-vercel-domain>/api/tastytrade/auth
```
Should return:
```json
{
  "status": "ok",
  "env": "sandbox",
  "accountInfo": { ... }
}
```

### Option Chain Endpoint
```bash
curl "https://<your-vercel-domain>/api/tastytrade/chains/SPX?exp=2024-12-20"
```
Should return an array of option contracts.

### Quote Stream (SSE)
```bash
curl -N "https://<your-vercel-domain>/api/tastytrade/stream/quotes?symbols=SPX,QQQ"
```
Should stream Server-Sent Events with quote updates.

---

## 6️⃣ Switch to Production Environment

When you're ready to trade live:

1. **In Vercel Settings → Environment Variables:**
   - Change `TASTYTRADE_ENV` from `sandbox` to `prod`
   - Update `TASTYTRADE_CLIENT_SECRET` with your **production** client secret
   - Update `TASTYTRADE_REFRESH_TOKEN` with your **production** refresh token

2. **Redeploy:**
   - Either push a new commit, or manually redeploy from the dashboard

This automatically points the app at the production broker endpoints (`https://api.tastytrade.com`).

---

## 7️⃣ Confirm App UI Integration

1. Open your deployed URL (e.g., `https://vibe-snipe-*.vercel.app`)
2. **Test the Create Trade view:**
   - You should see live market data flowing in (from `/api/tastytrade/stream/quotes`)
   - Option chains should load when selecting a symbol and expiration
3. **Test order submission (in sandbox):**
   - Create a test vertical spread order
   - You should see live order updates flow through the SSE stream
   - Check order status via `/api/tastytrade/orders/[id]`

---

## Troubleshooting

### Build Fails on Vercel
- Check that all environment variables are set correctly
- Verify TypeScript compilation passes locally: `npm run build`
- Check Vercel build logs for specific errors

### Auth Endpoint Returns 401
- Verify `TASTYTRADE_CLIENT_SECRET` and `TASTYTRADE_REFRESH_TOKEN` are correct
- Check that `TASTYTRADE_ENV` is set to `sandbox` or `prod`
- Ensure OAuth app has `read` and `trade` scopes

### Quote Stream Not Working
- Check that symbols are properly formatted (uppercase, valid tickers)
- Verify WebSocket connections are allowed in your Vercel plan
- Check browser console for SSE connection errors

### Order Submission Fails
- Verify you're using a valid account number
- Check that the account has sufficient permissions
- Ensure sandbox account has test funds (if applicable)

---

## Security Checklist

- ✅ Environment variables are set in Vercel (not in code)
- ✅ `.env.local` is in `.gitignore`
- ✅ No API secrets committed to repository
- ✅ OAuth refresh tokens are stored securely
- ✅ Production credentials are different from sandbox

---

## Next Steps

After successful deployment:

1. **Monitor API usage:**
   - Check Vercel function logs for API calls
   - Monitor rate limits and error rates

2. **Set up error tracking:**
   - Integrate Sentry or similar for error monitoring
   - Alert on failed authentication or order submissions

3. **Performance optimization:**
   - Monitor SSE connection stability
   - Consider implementing connection pooling for quote streams
   - Cache option chains where appropriate

---

## Support

For issues with:
- **Tastytrade API:** See [developer.tastytrade.com](https://developer.tastytrade.com)
- **Vercel Deployment:** Check [vercel.com/docs](https://vercel.com/docs)
- **This Integration:** Check `src/lib/tastytrade/` implementation files

---

**Last Updated:** $(date)
**Integration Version:** 1.0.0

