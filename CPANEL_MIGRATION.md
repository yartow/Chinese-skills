# Hosting Chinese Skills on cPanel

This guide covers migrating from Replit to a cPanel-based host. The app is a Node.js + React application backed by a PostgreSQL database.

---

## Prerequisites

Before you start, confirm your cPanel host supports:

- **Node.js apps** — look for "Setup Node.js App" in cPanel (powered by Phusion Passenger). Most modern shared hosts (e.g. Hostinger, A2 Hosting, SiteGround, Namecheap) include this.
- **PostgreSQL** — many cPanel hosts only offer MySQL. See the [Database options](#1-set-up-a-postgresql-database) section below for alternatives.
- **SSH access** — needed to run `npm install`, `npm run build`, and `npm run db:push`.

> **Minimum Node.js version:** 20 (check your host's available versions in the Node.js app settings).

---

## Step 1 — Set up a PostgreSQL database

### Option A: External PostgreSQL (recommended for shared hosting)

Most shared cPanel hosts do not offer PostgreSQL. Use a free cloud provider instead:

| Provider | Free tier | Notes |
|---|---|---|
| [Neon](https://neon.tech) | Yes (0.5 GB) | Serverless Postgres, easiest setup |
| [Supabase](https://supabase.com) | Yes (500 MB) | Also offers auth and storage |
| [Railway](https://railway.app) | Yes (limited hours) | Good for prototyping |
| [ElephantSQL](https://www.elephantsql.com) | Yes (20 MB) | Small but free forever |

After creating the database, copy the **connection string** — it will look like:

```
postgresql://user:password@host:5432/dbname
```

### Option B: cPanel-managed PostgreSQL

If your host offers PostgreSQL:

1. Open cPanel → **PostgreSQL Databases**
2. Create a new database (e.g. `youraccount_chinese`)
3. Create a database user and assign it full privileges on the database
4. Your connection string will be:
   ```
   postgresql://youraccount_dbuser:password@localhost:5432/youraccount_chinese
   ```

---

## Step 2 — Upload the code

### Option A: Git (if your host supports it)

SSH into your server and clone the repository into a folder **outside** `public_html` (the app serves its own static files):

```bash
cd ~
git clone https://github.com/yartow/Chinese-skills.git chinese-skills
cd chinese-skills
```

### Option B: File Manager / FTP

Compress the repository locally, upload the zip via cPanel File Manager, and extract it into a folder such as `~/chinese-skills/`. Exclude `node_modules/` and `dist/` — you will build those on the server.

---

## Step 3 — Create the environment file

SSH into your server:

```bash
cd ~/chinese-skills
cp .env.example .env
nano .env          # or use any editor
```

Fill in all values:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
SESSION_SECRET=<generate with: openssl rand -hex 32>
PORT=5000
NODE_ENV=production
```

> **SESSION_SECRET** must be a long random string. Generate one locally with:
> ```bash
> openssl rand -hex 32
> ```

---

## Step 4 — Configure the Node.js app in cPanel

1. Open cPanel → **Setup Node.js App**
2. Click **Create Application**
3. Fill in:
   | Setting | Value |
   |---|---|
   | Node.js version | 20.x (or latest LTS available) |
   | Application mode | Production |
   | Application root | `/home/youraccount/chinese-skills` |
   | Application URL | Your domain or subdomain |
   | Application startup file | `dist/index.js` |

4. Under **Environment variables**, add each variable from your `.env` file (or let the app read from the `.env` file directly — both approaches work).

5. Click **Create** / **Save**. cPanel will set up the Passenger configuration.

---

## Step 5 — Install dependencies and build

SSH into your server:

```bash
cd ~/chinese-skills

# Install all dependencies (including dev deps needed for the build)
npm install

# Build the frontend + backend
npm run build
```

This produces:
- `dist/public/` — compiled React frontend
- `dist/index.js` — compiled Express server

---

## Step 6 — Set up the database schema

Run the Drizzle migration to create all tables (run this once, and again after any schema changes):

```bash
npm run db:push
```

This creates the following tables in your PostgreSQL database:
- `users` — accounts (email + hashed password)
- `sessions` — user sessions
- `chinese_characters` — the character data
- `chinese_words` — the word data
- `character_progress`, `word_progress`, `user_settings`, `radicals` — user data

The app also auto-seeds characters and words from the JSON data files on first startup.

---

## Step 7 — Start the app

In cPanel → **Setup Node.js App**, click **Start** (or **Restart**) next to your application.

To verify it is running:

```bash
# Check Passenger status
passenger-status

# Or tail the app log
tail -f ~/logs/chinese-skills.log
```

---

## Step 8 — Point your domain

In cPanel → **Domains** (or **Subdomains**), make sure the domain/subdomain you selected in Step 4 points to the Node.js app. cPanel handles this automatically when you use the Setup Node.js App interface.

If you want HTTPS (strongly recommended — the session cookies are set to `secure: true` in production):

1. cPanel → **SSL/TLS** → **Let's Encrypt™ SSL** (or AutoSSL)
2. Issue a certificate for your domain
3. Wait a few minutes for propagation

---

## Step 9 — Create your first account

The app now uses email/password authentication (Replit Auth has been removed). Open your domain in a browser and register a new account via the sign-up form.

There is no separate admin account — any registered user has full access to their own progress data.

---

## Updating the app

When you push new code:

```bash
cd ~/chinese-skills
git pull origin main
npm install          # in case dependencies changed
npm run build        # rebuild frontend + backend
npm run db:push      # in case schema changed
```

Then in cPanel → **Setup Node.js App** → click **Restart**.

---

## Troubleshooting

### App shows 500 or fails to start

Check the Passenger error log (usually at `~/logs/passenger.log` or visible in cPanel). Common causes:

- `.env` file missing or `DATABASE_URL` incorrect — the server will crash at startup if it cannot reach Postgres.
- Node.js version too old — ensure you selected Node.js 20+.
- `dist/` folder missing — run `npm run build` again.

### Database connection refused

- For external databases: make sure your host does not block outbound connections to the Postgres port (5432). Some shared hosts do — in that case, use a provider that allows connections over port 443 (e.g. Neon with the `?sslmode=require` connection string option).
- For local PostgreSQL: use `localhost` in the connection string, not `127.0.0.1`.

### Sessions not persisting (logged out on every request)

- Ensure `SESSION_SECRET` is set and is the same across restarts.
- The `sessions` table must exist — run `npm run db:push` if you skipped it.

### Static files not loading (blank page)

Verify that `dist/public/` exists and contains `index.html`. If not, run `npm run build` again.

### Port conflicts

cPanel's Passenger proxies requests to the app on the port specified in `PORT`. You do not need to open that port in the firewall — Passenger handles the reverse proxy internally.

---

## Architecture overview

```
Browser → cPanel/Passenger → Express (dist/index.js, port 5000)
                                  ├── /api/*      → REST endpoints
                                  └── /*          → React SPA (dist/public/)
                                        ↓
                               PostgreSQL database
```

The app is entirely self-contained: the Express server serves both the API and the compiled React frontend. No separate web server (nginx/Apache) configuration is needed beyond what Passenger provides.
