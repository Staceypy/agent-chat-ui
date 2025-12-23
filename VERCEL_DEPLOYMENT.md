# Vercel Deployment Guide

This guide walks you through deploying the Agent Chat UI frontend to Vercel step by step.

## Prerequisites

- ✅ A Vercel account (sign up at [vercel.com](https://vercel.com))
- ✅ Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)
- ✅ Your environment variables ready (see Step 3)

---

## Step 1: Prepare Your Code Repository

### 1.1 Ensure Your Code is Committed

Make sure all your changes are committed and pushed to your Git repository:

```bash
# Check git status
git status

# Add all changes
git add .

# Commit changes
git commit -m "Prepare for Vercel deployment"

# Push to your repository
git push origin main
```

### 1.2 Verify Build Works Locally

Test that your project builds successfully:

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# If build succeeds, you're ready to deploy!
```

---

## Step 2: Connect Your Repository to Vercel

### 2.1 Sign In to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"** or **"Log In"**
3. Sign in with GitHub, GitLab, or Bitbucket (recommended for easy integration)

### 2.2 Import Your Project

1. Click **"Add New..."** → **"Project"** in your Vercel dashboard
2. Import your Git repository:
   - If you signed in with GitHub/GitLab/Bitbucket, you'll see your repositories
   - Select the repository containing your Agent Chat UI code
   - Click **"Import"**

### 2.3 Configure Project Settings

Vercel should auto-detect Next.js. Verify these settings:

- **Framework Preset**: Next.js (auto-detected)
- **Root Directory**: `./` (root of repository)
- **Build Command**: `pnpm build` (or leave default)
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `pnpm install` (or leave default)

---

## Step 3: Configure Environment Variables

This is **critical** for your deployment to work correctly!

### 3.1 Add Environment Variables in Vercel

In the project configuration page, scroll down to **"Environment Variables"** section and add:

#### Required Variables:

```bash
# Frontend configuration (public, exposed to browser)
NEXT_PUBLIC_API_URL=https://your-domain.vercel.app/api
NEXT_PUBLIC_ASSISTANT_ID=your-assistant-id

# Backend configuration (server-side only, kept secret)
LANGGRAPH_API_URL=https://your-deployed-agent.langgraph.app
LANGSMITH_API_KEY=lsv2_pt_your-api-key-here
```

### 3.2 Important Notes:

1. **`NEXT_PUBLIC_API_URL`**: 
   - Set this to `https://your-vercel-domain.vercel.app/api`
   - Replace `your-vercel-domain` with your actual Vercel domain
   - This points to your Next.js API proxy endpoint

2. **`NEXT_PUBLIC_ASSISTANT_ID`**: 
   - Your deployed assistant/graph ID
   - This is public (starts with `NEXT_PUBLIC_`)

3. **`LANGGRAPH_API_URL`**: 
   - Your deployed LangGraph server URL
   - This is server-side only (no `NEXT_PUBLIC_` prefix)

4. **`LANGSMITH_API_KEY`**: 
   - Your LangSmith API key
   - This is server-side only (no `NEXT_PUBLIC_` prefix)
   - Keep this secret!

### 3.3 Set for All Environments

Make sure to add these variables for:
- ✅ **Production**
- ✅ **Preview** (optional, for testing)
- ✅ **Development** (optional)

Click **"Save"** after adding each variable.

---

## Step 4: Deploy

### 4.1 Initial Deployment

1. After configuring environment variables, click **"Deploy"**
2. Vercel will:
   - Install dependencies (`pnpm install`)
   - Build your project (`pnpm build`)
   - Deploy to production

### 4.2 Monitor Deployment

Watch the deployment logs in real-time:
- Build logs will show progress
- Any errors will be displayed here
- Deployment typically takes 2-5 minutes

### 4.3 Update NEXT_PUBLIC_API_URL

**Important**: After your first deployment, you'll get a Vercel URL. Update the `NEXT_PUBLIC_API_URL` environment variable:

1. Go to **Project Settings** → **Environment Variables**
2. Edit `NEXT_PUBLIC_API_URL`
3. Set it to: `https://your-actual-vercel-url.vercel.app/api`
4. Redeploy (or it will auto-redeploy on next push)

---

## Step 5: Verify Deployment

### 5.1 Test Your Deployment

1. Visit your Vercel deployment URL (shown after deployment completes)
2. Test the URL parameters:
   ```
   https://your-app.vercel.app/?threadId=test-id&listingId=123&user_name=Test
   ```
3. Verify:
   - ✅ Page loads correctly
   - ✅ Chat interface appears
   - ✅ Can connect to your LangGraph agent
   - ✅ URL parameters work (`threadId`, `listingId`, `user_name`)

### 5.2 Check API Proxy

Test that the API proxy works:
- Visit: `https://your-app.vercel.app/api/info`
- Should return info about your LangGraph server (if configured correctly)

---

## Step 6: Configure Custom Domain (Optional)

### 6.1 Add Custom Domain

1. Go to **Project Settings** → **Domains**
2. Click **"Add Domain"**
3. Enter your custom domain (e.g., `chat.yourdomain.com`)
4. Follow DNS configuration instructions

### 6.2 Update Environment Variables

After adding custom domain, update:
- `NEXT_PUBLIC_API_URL` to use your custom domain: `https://chat.yourdomain.com/api`

---

## Step 7: Set Up Automatic Deployments

### 7.1 How It Works

Vercel automatically deploys when you push to your repository:
- **Production**: Deploys from `main` branch (or your default branch)
- **Preview**: Creates preview deployments for pull requests

### 7.2 Workflow

```bash
# Make changes locally
git add .
git commit -m "Update feature"
git push origin main

# Vercel automatically:
# 1. Detects the push
# 2. Builds the project
# 3. Deploys to production
```

---

## Troubleshooting

### Build Fails

**Error**: Build command failed
- Check build logs in Vercel dashboard
- Verify `pnpm build` works locally
- Ensure all dependencies are in `package.json`

**Error**: Module not found
- Check that all imports are correct
- Verify `node_modules` is in `.gitignore` (it should be)

### Environment Variables Not Working

**Issue**: `NEXT_PUBLIC_*` variables not accessible
- Ensure they're set in Vercel dashboard
- Redeploy after adding variables
- Check variable names match exactly (case-sensitive)

**Issue**: Server-side variables not working
- Verify they don't have `NEXT_PUBLIC_` prefix
- Check they're set for the correct environment (Production/Preview)

### API Proxy Not Working

**Error**: Failed to connect to LangGraph server
- Verify `LANGGRAPH_API_URL` is correct
- Check `LANGSMITH_API_KEY` is valid
- Test API endpoint: `https://your-app.vercel.app/api/info`

### URL Parameters Not Working

**Issue**: `threadId`, `listingId`, `user_name` not recognized
- Verify the code is pushed to repository
- Check browser console for errors
- Ensure latest code is deployed

---

## Environment Variables Reference

### Quick Checklist

Before deploying, ensure you have:

- [ ] `NEXT_PUBLIC_API_URL` - Your Vercel URL + `/api`
- [ ] `NEXT_PUBLIC_ASSISTANT_ID` - Your assistant/graph ID
- [ ] `LANGGRAPH_API_URL` - Your deployed LangGraph server URL
- [ ] `LANGSMITH_API_KEY` - Your LangSmith API key

### Example Values

```bash
# Production example
NEXT_PUBLIC_API_URL=https://agent-chat-ui.vercel.app/api
NEXT_PUBLIC_ASSISTANT_ID=my-assistant-id
LANGGRAPH_API_URL=https://my-agent.default.us.langgraph.app
LANGSMITH_API_KEY=lsv2_pt_abc123xyz789...
```

---

## Post-Deployment Checklist

After successful deployment:

- [ ] ✅ Test main page loads
- [ ] ✅ Test URL parameters (`?threadId=...&listingId=...&user_name=...`)
- [ ] ✅ Test chat functionality
- [ ] ✅ Verify API proxy connects to LangGraph
- [ ] ✅ Check environment variables are set correctly
- [ ] ✅ Test with actual agent conversation
- [ ] ✅ Set up custom domain (if needed)
- [ ] ✅ Configure automatic deployments

---

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Environment Variables Guide](https://vercel.com/docs/environment-variables)
- [Custom Domains](https://vercel.com/docs/custom-domains)

---

## Quick Deploy Command (Alternative Method)

If you prefer using Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

---

## Support

If you encounter issues:

1. Check Vercel deployment logs
2. Verify environment variables are set correctly
3. Test build locally first (`pnpm build`)
4. Check [Vercel Status Page](https://www.vercel-status.com/)
5. Review [Vercel Community](https://github.com/vercel/vercel/discussions)

---

**Happy Deploying! 🚀**

