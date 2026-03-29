# Deploy mini-crossword to Vercel

Use this guide to get your app live on Vercel. Your repo must be on GitHub first.

---

## 1. Sign in to Vercel

1. Go to **https://vercel.com**
2. Click **Sign Up** or **Log In**
3. Choose **Continue with GitHub** and authorize Vercel to access your GitHub account  
   (no credit card needed for the free Hobby plan)

---

## 2. Import your repo

1. On the Vercel dashboard, click **Add New…** → **Project**
2. Under **Import Git Repository**, find **mini-crossword** (or your repo name) and click **Import**
3. If you don’t see it, click **Adjust GitHub App Permissions** and grant Vercel access to the repo, then try again

---

## 3. Configure the project

Vercel usually detects Vite and pre-fills these. Confirm:

| Setting | Value |
|--------|--------|
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` (or `vite build`) |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

Leave **Root Directory** blank unless your app lives in a subfolder of the repo.

---

## 4. Add environment variables

Before deploying, add your Supabase keys so the build can talk to your database:

1. Expand **Environment Variables**
2. Add:

   | Name | Value |
   |------|--------|
   | `VITE_SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxxxx.supabase.co`) |
   | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon public key |

3. Copy the values from your local `.env` (do not commit `.env`; only set them in Vercel)
4. Leave **Environment** as **Production** (or add the same vars for Preview if you use branch deploys)

### AI clue hints (solver, optional)

The solver’s **AI hint** button calls a Vercel serverless function at `/api/ai-hint` (Google Gemini). The API key stays on the server only.

| Name | Value |
|------|--------|
| `GEMINI_API_KEY` | From [Google AI Studio](https://aistudio.google.com/apikey) (same project as Gemini API) |

Optional:

| Name | Default | Purpose |
|------|---------|---------|
| `GEMINI_MODEL` | `gemini-2.0-flash` | Model id for `generativelanguage.googleapis.com` |
| `AI_HINT_RATE_LIMIT_MAX` | `20` | Max AI hint requests per IP per sliding window (per serverless instance) |
| `AI_HINT_RATE_LIMIT_WINDOW_MS` | `60000` | Window length in ms |

**Logs:** Vercel → project → deployment → **Functions** / runtime logs. Full **user prompts** are logged as `[ai-hint] full user prompt:` (never the API key).

**Rate limiting:** In-memory per IP per warm instance. For stricter global limits, use [Vercel KV](https://vercel.com/docs/storage/vercel-kv) or Upstash Redis and replace `api/lib/rateLimit.js`.

**Local dev:** Run **`npx vercel dev`** (listens on port **3000** by default) in the project folder, and in another terminal run **`npm run dev`**. Vite proxies `/api/*` to `127.0.0.1:3000`. Add `GEMINI_API_KEY` to **`.env.local`** in the project root (Vercel loads it for `vercel dev`; do not commit it).

---

## 5. Deploy

1. Click **Deploy**
2. Wait for the build to finish (usually 1–2 minutes)
3. When it’s done, Vercel shows a **Visit** link (e.g. `https://mini-crossword-xxx.vercel.app`)
4. Open that URL and test: Create → Save to database, Solve → load from list

Your app is now live. Share the URL with friends.

---

## Updates (routine deploys)

- **Automatic:** Push to the branch you connected (e.g. `main`) → Vercel runs a new build and deploys. The same URL gets the new version.
- **Manual:** In the Vercel project, open the **Deployments** tab and click **Redeploy** on the latest deployment if needed.

No need to run `firebase deploy` or any other CLI; Vercel handles it from GitHub.

---

## Optional: custom domain

1. In the Vercel project, go to **Settings** → **Domains**
2. Add your domain and follow the DNS instructions Vercel shows
3. After DNS propagates, the app will be available at your domain over HTTPS
