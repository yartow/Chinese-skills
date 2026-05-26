# Self-Hosting Chinese Skills on a Home Server (Ubuntu)

This guide sets up the app on a Mac Mini (or any machine) running Ubuntu, controlled
entirely from your MacBook — no keyboard or monitor needed on the server.

**Stack:** Node.js 20 · PostgreSQL · PM2 · nginx · Let's Encrypt · Cloudflare DNS

---

## Part 1 — Connect to the Mac Mini from your MacBook

You need the Mac Mini's local IP address. Do this from your MacBook terminal.

### Find the Mac Mini's IP

**Option A — check your router**
Open your browser and go to your router's admin page (usually `192.168.1.1` or
`192.168.0.1`). Log in and look for a "Connected devices" or "DHCP leases" list.
Find an entry named something like `mac-mini` or `ubuntu`.

**Option B — scan the network from your MacBook**
```bash
# Install nmap if you don't have it
brew install nmap

# Scan your local subnet (adjust if your router uses 192.168.0.x)
nmap -sn 192.168.1.0/24
```

Look for an entry with a hostname containing "ubuntu" or the Mac Mini's MAC address
(Apple MAC addresses start with `00:17:f2`, `3c:07:54`, `a4:c3:f0`, etc.).

**Option C — try mDNS**
```bash
ping ubuntu.local
# or
ping mac-mini.local
```

### Enable SSH on the Mac Mini (if not already on)

If you can temporarily connect a keyboard/monitor just once:
```bash
sudo apt update && sudo apt install -y openssh-server
sudo systemctl enable ssh && sudo systemctl start ssh
```

If SSH is already running (Ubuntu Server editions have it by default), skip this.

### SSH in from your MacBook

```bash
ssh your_ubuntu_username@192.168.1.XXX
```

Replace `192.168.1.XXX` with the IP you found. Accept the fingerprint prompt (`yes`).

### Give the Mac Mini a fixed local IP (recommended)

Log into your router admin page → find "DHCP reservations" or "Static IP assignment"
→ assign the Mac Mini's MAC address a permanent local IP (e.g. `192.168.1.50`).
This prevents the local IP from changing after a router restart.

---

## Part 2 — Set up the server software

All commands below run over SSH on the **Mac Mini**.

### Update Ubuntu

```bash
sudo apt update && sudo apt upgrade -y
```

### Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # should print v20.x.x
```

### Install PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Create the database and user:

```bash
sudo -u postgres psql <<'SQL'
CREATE USER chineseskills WITH PASSWORD 'choose_a_strong_password';
CREATE DATABASE chineseskills OWNER chineseskills;
GRANT ALL PRIVILEGES ON DATABASE chineseskills TO chineseskills;
SQL
```

Your local connection string will be:
```
postgresql://chineseskills:choose_a_strong_password@localhost:5432/chineseskills
```

### Install nginx and Certbot

```bash
sudo apt install -y nginx
sudo systemctl enable nginx

sudo apt install -y certbot python3-certbot-nginx
```

### Install PM2 (process manager)

```bash
sudo npm install -g pm2
```

---

## Part 3 — Deploy the app

### Clone the repository

Put the app **outside** the web root (nginx will proxy to it):

```bash
cd ~
git clone https://github.com/yartow/Chinese-skills.git chinese-skills
cd chinese-skills
```

### Create the environment file

```bash
nano .env
```

Paste this, filling in your values:

```env
DATABASE_URL=postgresql://chineseskills:choose_a_strong_password@localhost:5432/chineseskills
SESSION_SECRET=generate_a_random_64_char_string_here
NODE_ENV=production
PORT=3000
```

Generate a session secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Save the file: `Ctrl+O`, `Enter`, `Ctrl+X`.

### Install dependencies and build

```bash
npm install
npm run build
```

### Run database migrations and seed

```bash
npm run db:push
```

This creates all tables and seeds the character/word/radical data. Takes about
30 seconds the first time.

### Test the app manually

```bash
node dist/index.js
```

Visit `http://192.168.1.XXX:3000` from your MacBook browser. If you see the app,
it works. Stop it with `Ctrl+C`.

---

## Part 4 — Keep the app running with PM2

```bash
cd ~/chinese-skills
pm2 start dist/index.js --name chinese-skills
pm2 save

# Make PM2 start automatically on reboot
pm2 startup
# Copy and run the command it prints (starts with "sudo env PATH=...")
```

Useful PM2 commands:
```bash
pm2 status              # see if app is running
pm2 logs chinese-skills # live logs
pm2 restart chinese-skills
pm2 stop chinese-skills
```

---

## Part 5 — Configure your domain

### Point your domain to your home IP

First, find your current public IP:
```bash
curl -s https://api.ipify.org
```

Log into your domain registrar (or Cloudflare if you use it for DNS) and add an
**A record**:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | chinese | YOUR_PUBLIC_IP | Auto |

This makes `chinese.yourdomain.com` point to your home. Changes take a few minutes
to a few hours to propagate.

> **Recommended:** Move your domain's nameservers to Cloudflare (free). Cloudflare
> gives you faster DNS propagation, free DDNS updates via API, and DDoS protection.
> See Part 6 for the DDNS setup.

### Open your router's firewall

In your router's admin panel, add two **port forwarding** rules pointing to the
Mac Mini's fixed local IP (e.g. `192.168.1.50`):

| External port | Internal port | Protocol |
|---------------|---------------|----------|
| 80 | 80 | TCP |
| 443 | 443 | TCP |

---

## Part 6 — Configure nginx and HTTPS

### nginx site config

```bash
sudo nano /etc/nginx/sites-available/chinese-skills
```

Paste:

```nginx
server {
    listen 80;
    server_name chinese.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it:
```bash
sudo ln -s /etc/nginx/sites-available/chinese-skills /etc/nginx/sites-enabled/
sudo nginx -t          # should say "syntax is ok"
sudo systemctl reload nginx
```

### Get a free SSL certificate

```bash
sudo certbot --nginx -d chinese.yourdomain.com
```

Follow the prompts (enter your email, agree to terms). Certbot automatically edits
your nginx config to redirect HTTP → HTTPS. Your site is now available at
`https://chinese.yourdomain.com`.

Certbot auto-renews the certificate every 90 days via a systemd timer — nothing
to do manually.

---

## Part 7 — Handle your dynamic home IP (DDNS)

Your ISP changes your public IP occasionally. Without automatic updates your domain
would stop working until you manually fix the DNS record.

### Option A — Cloudflare DDNS script (recommended if using Cloudflare)

1. Log into Cloudflare → **My Profile** → **API Tokens** → **Create Token**
   → use the "Edit zone DNS" template → scope it to your domain → create.

2. On the Mac Mini, create the update script:

```bash
nano ~/ddns-update.sh
```

```bash
#!/bin/bash
ZONE_ID="your_cloudflare_zone_id"          # Cloudflare dashboard → domain → Zone ID (right sidebar)
RECORD_ID="your_dns_record_id"             # see step 3 below
API_TOKEN="your_cloudflare_api_token"
RECORD_NAME="chinese.yourdomain.com"

CURRENT_IP=$(curl -s https://api.ipify.org)

curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"type\":\"A\",\"name\":\"$RECORD_NAME\",\"content\":\"$CURRENT_IP\",\"ttl\":60,\"proxied\":false}"
```

3. Get your DNS Record ID (run once):
```bash
curl -s -X GET "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/dns_records?name=chinese.yourdomain.com" \
  -H "Authorization: Bearer YOUR_API_TOKEN" | python3 -m json.tool | grep '"id"' | head -1
```

4. Make the script executable and schedule it:
```bash
chmod +x ~/ddns-update.sh

# Run every 5 minutes via cron
(crontab -l 2>/dev/null; echo "*/5 * * * * ~/ddns-update.sh > /dev/null 2>&1") | crontab -
```

### Option B — ddclient (works with most DNS providers)

```bash
sudo apt install -y ddclient
sudo nano /etc/ddclient.conf
```

Example for Cloudflare:
```
protocol=cloudflare
zone=yourdomain.com
ttl=1
login=your@email.com
password=your_cloudflare_api_token
chinese.yourdomain.com
```

```bash
sudo systemctl enable ddclient
sudo systemctl start ddclient
```

---

## Part 8 — Updating the app

When you push new code, SSH into the Mac Mini and run:

```bash
cd ~/chinese-skills
git pull origin main
npm install
npm run build
npm run db:push      # only needed if schema changed
pm2 restart chinese-skills
```

### Automate with a GitHub Actions pipeline (optional)

Create `.github/workflows/deploy.yml` in the repo:

```yaml
name: Deploy to home server

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: chinese.yourdomain.com
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd ~/chinese-skills
            git pull origin main
            npm install
            npm run build
            npm run db:push
            pm2 restart chinese-skills
```

In your GitHub repo → **Settings** → **Secrets and variables** → **Actions**, add:
- `SERVER_USER` — your Ubuntu username
- `SERVER_SSH_KEY` — your MacBook's private key (`cat ~/.ssh/id_ed25519`); add the
  public key to `~/.ssh/authorized_keys` on the Mac Mini first

---

## Part 9 — Create the admin account

The app has an admin role based on email address. By default, `admin@andrew-yong.com`
is the admin. You can override this by setting the `ADMIN_EMAILS` environment variable
to a comma-separated list of email addresses in your `.env` file.

### Create the admin account via SQL (first time only)

SSH into the Mac Mini and run:

```bash
sudo -u postgres psql chineseskills
```

Then paste this, replacing the hash with a real bcrypt hash (see below):

```sql
INSERT INTO users (email, first_name, password_hash)
VALUES (
  'admin@andrew-yong.com',
  'Admin',
  'BCRYPT_HASH_HERE'
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
```

**Generate a bcrypt hash from your MacBook** (no need to SSH):

```bash
cd ~/Documents/GitHub/Chinese-skills
node -e "
  const bcrypt = require('./node_modules/bcryptjs');
  const crypto = require('crypto');
  const pwd = crypto.randomBytes(16).toString('base64url');
  console.log('Password:', pwd);
  console.log('Hash:    ', bcrypt.hashSync(pwd, 12));
"
```

Copy the printed password somewhere safe, paste the hash into the SQL above, then run it.

---

## Part 10 — Connect to the production database from your MacBook

The production PostgreSQL listens only on `localhost` on the Mac Mini (it is not
exposed to the internet). To run queries from your MacBook you open an SSH tunnel.

### Open an SSH tunnel

```bash
# Replace mac-mini-ip with your Mac Mini's local IP (e.g. 192.168.1.50)
ssh -L 5433:localhost:5432 your_ubuntu_username@mac-mini-ip -N
```

Leave this terminal open. While it is running, port `5433` on your MacBook is
forwarded to port `5432` on the Mac Mini.

### Connect with psql

Open a **second terminal** on your MacBook:

```bash
psql "postgresql://chineseskills:choose_a_strong_password@localhost:5433/chineseskills"
```

You are now talking directly to the production database. Use standard SQL — for example:

```sql
-- List all users
SELECT id, email, created_at FROM users;

-- Check if admin account exists
SELECT email, (password_hash IS NOT NULL) AS has_password FROM users WHERE email = 'admin@andrew-yong.com';
```

Type `\q` to exit psql. Close the first terminal to drop the tunnel.

### Shortcut: run a one-off SQL command without opening psql

```bash
ssh -L 5433:localhost:5432 your_ubuntu_username@mac-mini-ip -N &
sleep 2
psql "postgresql://chineseskills:choose_a_strong_password@localhost:5433/chineseskills" \
  -c "SELECT email, created_at FROM users;"
kill %1   # close the tunnel
```

---

## Part 11 — Reset a user's password (admin endpoint)

Once you are logged in as `admin@andrew-yong.com`, you can reset any user's password
without touching the database directly.

```bash
curl -s -X POST https://chinese.yourdomain.com/api/admin/reset-password \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"email": "user@example.com", "newPassword": "NewTemporaryPass1"}'
```

**Step-by-step:**

1. Log in as admin and save the session cookie:

```bash
curl -s -X POST https://chinese.yourdomain.com/api/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email": "admin@andrew-yong.com", "password": "YOUR_ADMIN_PASSWORD"}'
```

2. Reset the target user's password:

```bash
curl -s -X POST https://chinese.yourdomain.com/api/admin/reset-password \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"email": "target@example.com", "newPassword": "TemporaryPassword1"}'
```

3. Tell the user their temporary password and ask them to change it after login.

You can also list all registered users:

```bash
curl -s https://chinese.yourdomain.com/api/admin/users -b cookies.txt | python3 -m json.tool
```

The cookie file (`cookies.txt`) is created in your current directory and is only valid
for the duration of the session (7 days). Delete it when you are done.

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Can't SSH from MacBook | `sudo systemctl status ssh` on Mac Mini (need keyboard once) |
| Port 80/443 not reachable | Router port forwarding rules; ISP may block port 80 (use 8080 + tell nginx) |
| SSL cert fails | DNS must have propagated first; check with `dig chinese.yourdomain.com` |
| App not starting | `pm2 logs chinese-skills` — usually a missing `.env` variable |
| DB connection refused | `sudo systemctl status postgresql`; check DATABASE_URL in `.env` |
| IP changed, site broken | Check `curl https://api.ipify.org` vs Cloudflare A record; DDNS script may not be running |

---

## Architecture overview

```
Internet → Router (port 443) → Mac Mini
                                  ├── nginx (SSL termination, reverse proxy)
                                  ├── Node.js app on :3000 (managed by PM2)
                                  └── PostgreSQL on :5432 (local only)

Your MacBook → SSH → Mac Mini (setup and updates)
GitHub → SSH → Mac Mini (optional CI/CD pipeline)
Cloudflare DDNS ← Mac Mini (updates A record every 5 min)
```
