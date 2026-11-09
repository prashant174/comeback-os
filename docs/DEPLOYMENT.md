# Deployment

## Option A — Docker Compose (simplest)
```bash
git clone <repo> comeback-os && cd comeback-os
cp .env.example .env        # set secrets; CLIENT_URL=https://your-domain; COOKIE_SECURE=true if HTTPS
docker compose up -d --build
docker compose logs -f backend
```
Put a host-level Nginx/Caddy with TLS in front of port `WEB_PORT`, or terminate TLS at a cloud load balancer.

## Option B — Linux VPS with Nginx + PM2

```bash
# Ubuntu 24.04
sudo apt update && sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm i -g pm2
# Install MongoDB 7 from the official repo (docs.mongodb.com → Install on Ubuntu), enable mongod
```

API:
```bash
cd /opt/comeback-os/backend
npm ci && npm run build
cp .env.example .env   # NODE_ENV=production, secrets, CLIENT_URL=https://your-domain, COOKIE_SECURE=true
mkdir -p logs && pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
```

Frontend:
```bash
cd /opt/comeback-os/frontend && npm ci && npm run build
sudo mkdir -p /var/www/comeback-os && sudo cp -r dist/* /var/www/comeback-os/
```

`/etc/nginx/sites-available/comeback-os`:
```nginx
server {
  listen 80;
  server_name your-domain.com;
  root /var/www/comeback-os;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
  location / { try_files $uri /index.html; }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/comeback-os /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d your-domain.com
```

The API sets `trust proxy` = 1 so rate limiting sees real client IPs behind Nginx.

## Option C — Windows VM (internal)
Same as Option B with: MongoDB as a Windows service, `pm2` + `pm2-windows-startup` (or NSSM) for the API, and IIS/Nginx-for-Windows serving `frontend/dist` with `/api` reverse-proxied to `127.0.0.1:5000`. Over plain HTTP on a LAN keep `COOKIE_SECURE=false`.

## Hardening checklist
- [ ] Unique 64+ char secrets, `.env` not committed
- [ ] `ALLOW_REGISTRATION=false` after creating your account
- [ ] HTTPS + `COOKIE_SECURE=true`
- [ ] MongoDB bound to 127.0.0.1 (or Docker network only); enable auth if exposed
- [ ] Nightly `mongodump` via cron, copied off-server
- [ ] `pm2 logs` / `docker compose logs` monitored
