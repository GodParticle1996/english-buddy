# EnglishBuddy — Self-Hosted Web Deployment Guide

This guide shows how to run **EnglishBuddy** as a web app on a **Raspberry Pi 5** from your **Windows 11 + WSL** development environment, expose it to the internet, use your own domain name, and add load balancing with Docker + Nginx.

> **Important context:** EnglishBuddy is an **Expo / React Native** mobile app. It is not a traditional website. However, Expo can compile it to a web app (`expo start --web`). This guide uses that web build and hosts it on a Raspberry Pi. Native mobile features (microphone, haptics) may be limited or behave differently in the browser; voice search may need browser permission handling.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Development Setup on Windows 11 + WSL](#2-development-setup-on-windows-11--wsl)
3. [Prepare EnglishBuddy for the Web](#3-prepare-englishbuddy-for-the-web)
4. [Raspberry Pi 5 Server Setup](#4-raspberry-pi-5-server-setup)
5. [Deploy with Docker (2 Containers + Load Balancer)](#5-deploy-with-docker-2-containers--load-balancer)
6. [Expose to the Internet & Custom Domain](#6-expose-to-the-internet--custom-domain)
7. [Optional: Add Nginx SSL (HTTPS)](#7-optional-add-nginx-ssl-https)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet Users                        │
│                (type https://your-domain.com)                │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  Cloudflare Tunnel / ngrok / DuckDNS   │  (public URL / domain)
        └───────────────────┬───────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │        Nginx Load Balancer             │
        │    (port 80/443, round-robin)          │
        └───────────────┬───────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
  ┌─────────────┐               ┌─────────────┐
  │   english-  │               │   english-  │
  │   buddy-1   │               │   buddy-2   │
  │  (port 8081)│               │  (port 8082)│
  └─────────────┘               └─────────────┘
        ▲                               ▲
        │      Both on Raspberry Pi 5    │
        └───────────────────────────────┘
```

---

## 2. Development Setup on Windows 11 + WSL

### 2.1 Install / Update WSL

Open PowerShell as Administrator:

```powershell
wsl --install -d Ubuntu
```

Restart your PC, then open **Ubuntu** from the Start Menu.

Update packages:

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # should be v22.x
npm -v    # should be 10.x
```

### 2.3 Install Git

```bash
sudo apt install -y git
```

### 2.4 Clone the EnglishBuddy repo

In WSL:

```bash
mkdir -p ~/projects
cd ~/projects
git clone <your-repo-url> english-buddy
cd english-buddy
```

Or copy the existing project into WSL:

```bash
cp -r /mnt/c/Users/<YourName>/english-buddy ~/projects/english-buddy
cd ~/projects/english-buddy
```

### 2.5 Install dependencies

```bash
npm install
```

### 2.6 Create environment file

```bash
cp .env.example .env
nano .env
```

Fill in at least:

```env
EXPO_PUBLIC_TOKENMIX_API_KEY=sk-tm-...
EXPO_PUBLIC_GROQ_API_KEY=gsk_...
```

> Keep these keys secret. Do not commit `.env`.

### 2.7 Test the web build locally

```bash
npx expo start --web
```

It will print a local URL, usually:

```
http://localhost:8081
```

Open it in Windows Chrome/Edge at:

```
http://localhost:8081
```

If that does not work from Windows, find WSL’s IP:

```bash
ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1
```

Then open `http://<wsl-ip>:8081` in Windows.

> **Tip:** For mobile development with Expo Go on your iPhone, use `npx expo start --tunnel` because WSL LAN QR codes often fail.

---

## 3. Prepare EnglishBuddy for the Web

### 3.1 Check web compatibility

Because this app uses React Native APIs, some features may not work in the browser without polyfills:

- `expo-haptics` — no effect on web, but usually safe.
- `expo-speech` — works in most browsers.
- `expo-audio` recording — requires browser microphone permissions. You may need a web-compatible recording solution for reliable voice search.

For a simple public deployment, the existing `expo start --web` build is enough.

### 3.2 Create a production web build

Expo can bundle a static web app. Add this script to `package.json`:

```json
"scripts": {
  "start": "expo start",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "web": "expo start --web",
  "build:web": "npx expo export --platform web"
}
```

Then run:

```bash
npm run build:web
```

This creates a `dist/` folder containing static files.

### 3.3 Test the static build locally

```bash
npx serve dist -p 8081
```

Open `http://localhost:8081` in your browser.

---

## 4. Raspberry Pi 5 Server Setup

### 4.1 Hardware & OS

- **Raspberry Pi 5** (4 GB RAM minimum, 8 GB recommended).
- **Raspberry Pi OS Lite (64-bit, Debian Bookworm)** or **Ubuntu Server 24.04 LTS for ARM**.
- A reliable power supply (official 27 W USB-C PSU recommended).
- MicroSD card or NVMe/SSD (64 GB+ recommended).

Install Raspberry Pi OS using **Raspberry Pi Imager** from Windows. Enable SSH in the imager settings.

### 4.2 First boot & SSH

From Windows PowerShell / WSL, find the Pi’s IP from your router, or use:

```powershell
ping raspberrypi.local
```

SSH in:

```bash
ssh pi@raspberrypi.local
# default password: raspberry  (change immediately with passwd)
```

### 4.3 Basic Pi setup

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git vim htop nginx

# Optional but recommended: create a non-root user
sudo adduser deploy
sudo usermod -aG sudo deploy
```

### 4.4 Install Node.js on the Pi

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### 4.5 Install Docker & Docker Compose

```bash
# Remove old versions if any
for pkg in docker.io docker-doc docker-compose podman-docker containerd runc; do sudo apt remove $pkg; done

# Add Docker's official GPG key
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add your user to docker group so you can run docker without sudo
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

---

## 5. Deploy with Docker (2 Containers + Load Balancer)

### 5.1 Copy the project to the Pi

From WSL:

```bash
cd ~/projects/english-buddy
# Exclude node_modules and dist
rsync -avz --exclude=node_modules --exclude=dist --exclude=.git ./ deploy@raspberrypi.local:/home/deploy/english-buddy/
```

> If `rsync` is not installed on Windows/WSL: `sudo apt install -y rsync`

### 5.2 SSH into the Pi and create a Dockerfile

```bash
ssh deploy@raspberrypi.local
cd /home/deploy/english-buddy
```

Create `Dockerfile`:

```dockerfile
# Stage 1: Build the web app
FROM node:22-bookworm AS builder

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm ci

# Copy source and build the static web export
COPY . .
RUN npx expo export --platform web

# Stage 2: Serve with a lightweight static server
FROM node:22-bookworm-slim AS runner

WORKDIR /app
RUN npm install -g serve

# Copy the built static files from the builder stage
COPY --from=builder /app/dist ./dist

# The container listens on the port provided at runtime (default 8080)
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "serve dist -p ${PORT}"]
```

Create `.dockerignore`:

```gitignore
node_modules
dist
.git
.env
.DS_Store
```

### 5.3 Create Docker Compose file

Create `docker-compose.yml`:

```yaml
version: "3.9"

services:
  english-buddy-1:
    build: .
    container_name: english-buddy-1
    restart: unless-stopped
    environment:
      - PORT=8081
    expose:
      - "8081"
    networks:
      - english-buddy-net

  english-buddy-2:
    build: .
    container_name: english-buddy-2
    restart: unless-stopped
    environment:
      - PORT=8082
    expose:
      - "8082"
    networks:
      - english-buddy-net

  nginx:
    image: nginx:alpine
    container_name: english-buddy-nginx
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - english-buddy-1
      - english-buddy-2
    networks:
      - english-buddy-net

networks:
  english-buddy-net:
    driver: bridge
```

### 5.4 Create the Nginx load balancer config

Create `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream english_buddy_app {
        least_conn;  # or round-robin by default
        server english-buddy-1:8081;
        server english-buddy-2:8082;
    }

    server {
        listen 80;
        server_name _;  # accept any host

        location / {
            proxy_pass http://english_buddy_app;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### 5.5 Build and run the containers

On the Pi:

```bash
cd /home/deploy/english-buddy
docker compose up --build -d
```

Check status:

```bash
docker ps
docker compose logs -f
```

Test locally from the Pi:

```bash
curl http://localhost
```

You should see the EnglishBuddy HTML.

### 5.6 Verify load balancing

Check which backend served the request:

```bash
# Run multiple times and watch container logs
for i in {1..6}; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost; done

docker logs english-buddy-1 --tail 20
docker logs english-buddy-2 --tail 20
```

Both containers should show incoming requests.

---

## 6. Expose to the Internet & Custom Domain

You have several options. The easiest for a hobby project is **Cloudflare Tunnel** (free, custom domain, HTTPS). **ngrok** is great for quick testing but custom domains require a paid plan.

### Option A: Cloudflare Tunnel (Recommended — free custom domain + HTTPS)

**Requirements:** A domain name you own (e.g., from Namecheap, GoDaddy, Cloudflare Registrar).

1. **Point your domain to Cloudflare**
   - Sign up at [cloudflare.com](https://cloudflare.com).
   - Add your site and update your domain registrar’s nameservers to Cloudflare’s.

2. **Install `cloudflared` on the Pi**

   ```bash
   # Debian / Ubuntu / Raspberry Pi OS
   sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
   echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared bookworm main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
   sudo apt update
   sudo apt install -y cloudflared
   ```

3. **Authenticate and create a tunnel**

   ```bash
   cloudflared tunnel login
   ```

   This gives you a URL to open in your browser and authorizes the Pi.

   ```bash
   cloudflared tunnel create english-buddy-tunnel
   cloudflared tunnel route dns english-buddy-tunnel englishbuddy.yourdomain.com
   ```

4. **Configure the tunnel**

   Create `~/.cloudflared/config.yml`:

   ```yaml
   tunnel: <tunnel-id-from-previous-command>
   credentials-file: /home/deploy/.cloudflared/<tunnel-id>.json

   ingress:
     - hostname: englishbuddy.yourdomain.com
       service: http://localhost:80
     - service: http_status:404
   ```

5. **Run the tunnel**

   ```bash
   cloudflared tunnel run english-buddy-tunnel
   ```

   Or install as a service:

   ```bash
   sudo cloudflared service install
   sudo systemctl enable --now cloudflared
   ```

6. **Visit**

   ```
   https://englishbuddy.yourdomain.com
   ```

### Option B: ngrok (Quick testing; custom domain is paid)

1. Install ngrok on the Pi:

   ```bash
   curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
     | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
   echo "deb https://ngrok-agent.s3.amazonaws.com buster main" \
     | sudo tee /etc/apt/sources.list.d/ngrok.list
   sudo apt update && sudo apt install -y ngrok
   ```

2. Sign up at [ngrok.com](https://ngrok.com), copy your authtoken, and configure:

   ```bash
   ngrok config add-authtoken <your-token>
   ```

3. Expose the local Nginx on port 80:

   ```bash
   ngrok http 80
   ```

   You get a public URL like `https://abc123.ngrok.io`.

4. **Custom domain:** Requires an **ngrok Pro/Epay** plan. If you pay, you can reserve a domain in the dashboard and run:

   ```bash
   ngrok http --domain=englishbuddy.yourdomain.com 80
   ```

### Option C: Tailscale Funnel (Very easy if you use Tailscale)

If you already use Tailscale on your Pi and Windows PC:

```bash
sudo tailscale funnel --bg --set-path / --http 80 8080
```

Then share the Tailscale machine URL or set up a custom DNS record via Tailscale.

### Option D: DuckDNS + Reverse Proxy (free subdomain, no custom domain)

If you do **not** own a domain but want a stable free subdomain:

1. Go to [duckdns.org](https://duckdns.org) and create a subdomain like `english-buddy.duckdns.org`.
2. Install the DuckDNS update script on the Pi so your dynamic home IP is kept up to date.
3. Forward port `80` and `443` on your router to the Pi’s local IP.
4. Access via `http://english-buddy.duckdns.org`.

> This exposes your home network directly. Use a firewall (`ufw`) and HTTPS (e.g., Let’s Encrypt + Nginx) if you choose this route.

---

## 7. Optional: Add Nginx SSL (HTTPS)

If you use **Cloudflare Tunnel**, HTTPS is handled automatically.

If you use **DuckDNS / your own domain pointing directly to your home IP**, get a free Let’s Encrypt certificate:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d englishbuddy.yourdomain.com
```

Then update `nginx.conf` to listen on `443 ssl` and use the generated certificate files.

---

## 8. Troubleshooting

| Problem | Solution |
|---------|----------|
| `npx expo start --web` shows a blank page | Check browser console for missing polyfills; some React Native APIs do not work on web. |
| Docker build fails on Pi | Ensure you are using ARM64 images (`node:22-bookworm` supports ARM64). |
| `docker compose up` hangs | Run `docker compose build --no-cache` then `docker compose up -d`. |
| Nginx returns `502 Bad Gateway` | Verify both app containers are running: `docker ps` and `docker compose logs english-buddy-1`. |
| Microphone does not work on web | Browsers require HTTPS for microphone access. Use Cloudflare Tunnel or HTTPS via Let’s Encrypt. |
| Cloudflare Tunnel not connecting | Check `cloudflared tunnel list` and ensure the tunnel credentials file path is correct in `config.yml`. |
| Slow response on Pi 5 | Build the static site once and serve it; avoid running the Expo dev server in production. |

---

## Quick Command Reference

### WSL development
```bash
cd ~/projects/english-buddy
npm install
npx expo start --web        # dev server
npm run build:web           # static export
npx serve dist -p 8081      # test static build
```

### Deploy to Pi
```bash
rsync -avz --exclude=node_modules --exclude=dist --exclude=.git ./ deploy@raspberrypi.local:/home/deploy/english-buddy/
ssh deploy@raspberrypi.local
cd /home/deploy/english-buddy
docker compose up --build -d
```

### Monitor Pi
```bash
docker ps
docker compose logs -f
docker stats
htop
```

---

## Summary of Choices

| Goal | Recommended Tool |
|------|------------------|
| Development on Windows | WSL2 + Ubuntu + Node 22 |
| Web build of Expo app | `npx expo export --platform web` |
| Server OS on Pi | Raspberry Pi OS 64-bit or Ubuntu Server 24.04 ARM |
| Containerization | Docker + Docker Compose |
| Load balancer | Nginx (round-robin or least_conn) |
| Public access + free HTTPS + custom domain | **Cloudflare Tunnel** |
| Quick temporary public URL | ngrok |
| Free subdomain without buying a domain | DuckDNS |

---

**Next step:** Finish local development in WSL, verify `npm run build:web` produces a working `dist/`, then copy it to the Pi and run the Docker Compose stack.
