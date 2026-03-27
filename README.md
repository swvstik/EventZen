# EventZen

EventZen is a polyglot event management platform built as a microservices system.
It combines a React frontend with Node.js, Spring Boot, and ASP.NET Core services
behind a single Nginx gateway.

## Architecture

- Frontend: React + Vite
- API Gateway: Nginx
- Backend services:
	- Node.js service for auth, attendees, notifications, uploads
	- Spring Boot service for events, venues, schedules
	- ASP.NET Core service for budgets and financial reports
- Data + infra:
	- MongoDB (Node and .NET domains)
	- MySQL (Spring domain)
	- Redpanda/Kafka (event-driven messaging)
	- MinIO (object storage for media)

## Repository Structure

```text
.
├─ client/                 # React + Vite frontend
├─ nginx/                  # Gateway Dockerfile + Nginx routing config
├─ server/
│  ├─ backend-node/        # Node.js auth/attendees/notifications
│  ├─ backend-spring/      # Spring Boot events/venues/schedule
│  └─ backend-dotnet/      # ASP.NET Core budget/reporting
├─ scripts/                # Cross-service quality gate and utilities
├─ docker-compose.yml      # Full local stack (frontend + all backends + infra)
└─ .env.example            # Required environment variables template
```

## What Runs Where

- Public entry point: http://localhost:8080
- Gateway health: http://localhost:8080/health
- Internal backend container ports:
	- Node service: 8081
	- Spring service: 8082
	- .NET service: 8083
- Local host-exposed infra ports (for tooling only):
	- MongoDB: 27018
	- MySQL: 3307
	- MinIO API: 9000
	- MinIO Console: 9001
	- Kafka external: 9094

## Quick Start (Docker, Recommended)

### 1. Prepare environment

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set real values for at least:

- `JWT_SECRET`
- `INTERNAL_SERVICE_SECRET`
- `TOKEN_HASH_SECRET`
- `MYSQL_ROOT_PASSWORD`
- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASS`

### 2. Build and start everything

```bash
docker compose up --build
```

This command builds and installs dependencies for all services, including the
frontend build that is bundled into the Nginx gateway image.

On startup, Compose also runs an idempotent `user-seed` job that upserts default
test users into MongoDB, so no manual seeding step is required.

Default test users:

- `admin@ez.local` (ADMIN)
- `vendor@ez.local` (VENDOR)
- `user@ez.local` (CUSTOMER)
- Password for all: `Eventzen@2026!` (override with `TEST_USER_PASSWORD`)

If you need to re-run seeding manually:

```bash
docker compose run --rm user-seed
```

### 3. Verify health

```bash
curl http://localhost:8080/health
```

Expected response: JSON status from `nginx-gateway`.

### 4. Stop stack

```bash
docker compose down
```

Remove containers and volumes:

```bash
docker compose down -v
```

`docker compose down -v` removes persisted databases; next startup will seed
the default users again.

## Local Development (Without Full Compose)

Use this mode if you want to run services individually.

### Frontend

```bash
cd client
npm install
npm run dev
```

### Node service

```bash
cd server/backend-node
npm install
npm run dev
```

### Spring service

```bash
cd server/backend-spring
mvn spring-boot:run
```

### .NET service

```bash
cd server/backend-dotnet/EventZen.Budget
dotnet restore
dotnet run
```

## API Routing Through Gateway

The gateway forwards requests as follows:

- `/api/auth`, `/api/attendees`, `/api/notifications`, `/api/users`, `/api/uploads`, `/api/payments`, vendor-application routes -> Node service
- `/api/events`, `/api/venues`, `/api/schedule` -> Spring service
- `/api/budget`, `/api/reports` -> .NET service
- `/media` -> MinIO
- Non-API routes -> React SPA static build

## Testing and Quality Gate

Run the repository-wide quality gate from project root:

```powershell
./scripts/run_quality_gate.ps1
```

What it runs:

- Node unit tests
- Optional Node Kafka integration tests
- Spring tests
- .NET tests
- Client lint
- Client production build

To skip Kafka integration checks:

```powershell
./scripts/run_quality_gate.ps1 -WithKafkaIntegration:$false
```

## Service Documentation

- Node service docs: `server/backend-node/README.md`
- Spring service docs: `server/backend-spring/README.md`
- .NET service docs: `server/backend-dotnet/README.md`
- Spring testing guide: `server/backend-spring/TESTING.md`
- .NET testing guide: `server/backend-dotnet/TESTING.md`

## Tech Stack

- React 19 + Vite 8
- Node.js 20
- Spring Boot 3 (Java 21)
- ASP.NET Core (.NET 10 image in Dockerfile)
- MongoDB 7 + MySQL 8
- Redpanda (Kafka API)
- MinIO
- Nginx

## Implementation To-Do
- Secrets manager service
- CI/CD
- Prometheus & Grafana for monitoring