# EventZen — Docker & CI/CD Guide

Everything you need to run, test, and deploy the full EventZen stack.

---

## What is Docker and why do we use it?

Think of Docker as a way to package your entire application — code, dependencies, environment — into a portable box called a **container**. The box runs identically on your laptop, your teammate's machine, and a cloud server.

Without Docker: "works on my machine" is a real problem.  
With Docker: `docker compose up --build` and it works everywhere.

### The seven containers in EventZen

```
Your Browser
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  Nginx Gateway  :8080  ← the ONLY port open to the world    │
│  Routes /api/* to the right backend, everything else → 404  │
└────────┬─────────────┬────────────────┬──────────────────────┘
         │             │                │
         ▼             ▼                ▼
a    :8081         :8082             :8083
     Node.js       Spring Boot       ASP.NET
     :8081         :8082             :8083
    Auth/Attend   Events/Venues     Budget
    MongoDB       MySQL             MongoDB
         │             │                │
         ▼             ▼                ▼
    ┌─────────────────────────────────────────────┐
    │  MongoDB :27017          MySQL :3306         │
    │  eventzen_node           eventzen            │
    │  eventzen_budget                             │
    └─────────────────────────────────────────────┘
```

---

## Local development (running everything)

### 1. Prerequisites

Install these once:
- **Docker Desktop** → https://www.docker.com/products/docker-desktop
- **Git** → https://git-scm.com

### 2. Setup

```bash
# Clone the repo
git clone <your-repo-url>
cd eventzen

# Create your .env file from the template
cp .env.example .env

# Open .env and fill in your values (see comments inside)
# Minimum required: JWT_SECRET, MYSQL_ROOT_PASSWORD
```

### 3. Run

```bash
# Build all images and start everything
docker compose up --build

# First run takes ~3-5 minutes (downloading base images, compiling Java/C#).
# Subsequent runs are much faster — Docker caches layers.
```

Verify gateway health at **http://localhost:8080/health**. API routes are available under **http://localhost:8080/api/**.

### 4. Useful commands

```bash
# Start in background (no log output)
docker compose up --build -d

# View logs for a specific service
docker compose logs -f node-service
docker compose logs -f spring-service

# Stop everything (keeps your database data)
docker compose down

# Stop and DELETE all data (fresh start)
docker compose down -v

# Rebuild only one service after a code change
docker compose up --build node-service

# Open a shell inside a running container
docker compose exec node-service sh
docker compose exec spring-service bash
```

### 5. Ports exposed to your machine

| Service | Port | Use |
|---|---|---|
| Nginx gateway | **8080** | Your app — http://localhost:8080 |
| MongoDB | 27017 | Connect with MongoDB Compass locally |
| MySQL | 3306 | Connect with MySQL Workbench locally |

---

## How Docker works under the hood

### Dockerfile
A recipe for building one container image. It says:
- Start from this base image (e.g. `node:20-alpine`)
- Copy these files
- Run these commands (install deps, compile code)
- Start with this command

### docker-compose.yml
Orchestrates multiple containers together. It says:
- Run these 7 containers
- Connect them on this private network
- Pass these environment variables to each
- Wait for this healthcheck before starting that service

### Healthchecks
Spring Boot crashes if MySQL isn't ready yet. The `healthcheck:` on mysql-db runs `mysqladmin ping` every 10 seconds. `spring-service` has `depends_on: mysql-db: condition: service_healthy` — it won't start until MySQL passes 10 consecutive pings.

### Named volumes
`mongo_data` and `mysql_data` are Docker volumes — they persist your data between `docker compose down` restarts. Only `docker compose down -v` deletes them.

---

## CI/CD with GitHub Actions

CI/CD means **Continuous Integration / Continuous Deployment**. The idea:
- **CI**: Every time you push code, automatically check it compiles and works
- **CD**: Every time CI passes on `main`, automatically deploy to your server

### The pipeline (.github/workflows/)

```
You push code to GitHub
        │
        ▼
CI pipeline runs (ci.yml)
     ├── Docker: build all backend images
  └── Smoke test: docker compose up → curl /health on each service
        │
        │ (only if CI passes AND branch is main)
        ▼
CD pipeline runs (cd.yml)
  ├── Build images → push to Docker Hub
  │     eventzen-node:abc123, eventzen-node:latest
  │     eventzen-spring:abc123, eventzen-spring:latest
  │     eventzen-dotnet:abc123, eventzen-dotnet:latest
  └── SSH into server → docker compose pull → docker compose up -d
```

### Setup for CD (skip if you just want local Docker)

You need a server (e.g. a $5/month DigitalOcean droplet running Ubuntu).

**On your server:**
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Clone the repo and set up the project folder
git clone <your-repo-url> /home/ubuntu/eventzen
cd /home/ubuntu/eventzen
cp .env.example .env
# Fill in .env with production values
```

**On GitHub (Settings → Secrets and variables → Actions):**

| Secret name | Value |
|---|---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token (hub.docker.com → Account → Security) |
| `DEPLOY_HOST` | Your server's IP address |
| `DEPLOY_USER` | `ubuntu` (or whatever your SSH username is) |
| `DEPLOY_SSH_KEY` | Your private SSH key (contents of `~/.ssh/id_rsa`) |
| `DEPLOY_PATH` | `/home/ubuntu/eventzen` |
| `DEPLOY_ENV` | The entire contents of your production `.env` file |

Once set up: push to `main` → CI runs → CD runs → live site is updated automatically.

---

## Environment variables

The root `.env` file is the single source of truth for Docker Compose.
Docker Compose reads it automatically — no flag needed.

| Variable | Required | Used by |
|---|---|---|
| `JWT_SECRET` | ✅ | All 3 backends — **must be identical** |
| `MYSQL_ROOT_PASSWORD` | ✅ | MySQL container + Spring Boot |
| `INTERNAL_SERVICE_SECRET` | ✅ | Node.js → Spring Boot internal calls |
| `SMTP_HOST` | for email | Node.js (Nodemailer) |
| `SMTP_USER` | for email | Node.js (Nodemailer) |
| `SMTP_PASS` | for email | Node.js (Nodemailer) |
| `MINIO_ROOT_USER` | optional | MinIO root login (defaults to minioadmin) |
| `MINIO_ROOT_PASSWORD` | optional | MinIO root password |
| `MINIO_BUCKET` | optional | Bucket used by backend uploads |
| `MINIO_PUBLIC_BASE_URL` | optional | Public media base URL (default `http://localhost:8080/media`) |

---

## Folder structure

```
eventzen/                     ← GitHub repo root
├── docker-compose.yml        ← orchestrates everything
├── .env.example              ← copy to .env and fill in
├── .gitignore
├── nginx/
│   └── nginx.conf            ← API routing rules
├── .github/
│   └── workflows/
│       ├── ci.yml            ← runs on every push
│       └── cd.yml            ← runs on push to main
├── server/
│   ├── backend-node/         ← Node.js service
│   │   ├── Dockerfile.node
│   │   └── src/
│   ├── backend-spring/       ← Spring Boot service
│   │   ├── Dockerfile.spring
│   │   └── src/
│   └── backend-dotnet/       ← ASP.NET service
│       ├── Dockerfile.dotnet
│       └── EventZen.Budget/
```
