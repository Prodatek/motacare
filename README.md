# Mota
basic app for app infrastructure. 
# 🔧 Motacare

> AI-assisted vehicle inspection and maintenance tracking platform

Motacare is a microservices-based SaaS platform for workshops and vehicle owners. Fixers log detailed inspection reports, owners get full transparency on their vehicle history, and AI generates intelligent diagnostic summaries from form data and OBD readings.

---

## 📁 Project Structure

```
motacare/
├── apps/
│   ├── api-gateway/          # Reverse proxy + request routing (port 3000)
│   ├── auth-service/         # Auth, users, roles, JWT (port 3001)
│   ├── vehicle-service/      # Car registration + hash generation (port 3002)
│   ├── inspection-service/   # Inspection forms + fix lifecycle (port 3003)
│   └── web/                  # Next.js frontend (port 3005)
├── packages/
│   ├── shared-types/         # TypeScript interfaces shared across all services
│   ├── shared-utils/         # Common helpers (hashing, validation, logger)
│   └── ui-components/        # Shared React components
├── infra/
│   ├── docker/               # Per-service Dockerfiles + postgres init
│   ├── terraform/            # Cloud infrastructure (Phase 5)
│   └── k8s/                  # Kubernetes manifests (Phase 5)
└── .github/
    └── workflows/            # CI/CD pipelines
```

---

## 🚀 Getting Started (Local Development)

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20.0.0
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [Git](https://git-scm.com/)

### 1. Clone the repository

```bash
git clone https://github.com/your-org/motacare.git
cd motacare
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env and fill in your values
```

### 3. Start the full stack

```bash
docker-compose up -d
```

### 4. Verify all services are running

```bash
docker-compose ps
```

| Service | URL |
|---|---|
| API Gateway | http://localhost:3000 |
| Auth Service | http://localhost:3001 |
| Vehicle Service | http://localhost:3002 |
| Inspection Service | http://localhost:3003 |
| Web Frontend | http://localhost:3005 |
| pgAdmin (DB UI) | http://localhost:5050 |

### 5. Install dependencies locally (for IDE support)

```bash
npm install
```

---

## 🛠️ Development Commands

```bash
# Start all services in dev mode (with hot reload)
docker-compose up -d

# View logs for a specific service
docker-compose logs -f auth-service

# Restart a single service
docker-compose restart vehicle-service

# Stop everything
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Run tests across all packages
npm run test

# Lint all packages
npm run lint

# Build all packages
npm run build
```

---

## 🌿 Branch Strategy

```
main          → production-ready code
staging       → staging environment (auto-deploys on push)
dev           → active development
feature/*     → individual features (PRs into dev)
fix/*         → bug fixes
```

---

## 🔐 Environment Variables

See `.env.example` for all required variables. Never commit `.env` to version control.

---

## 📦 Services Overview

### Auth Service (`/apps/auth-service`)
Handles user registration, login, JWT issuance, refresh tokens, and role-based access control. Roles: `OWNER`, `FIXER`, `ADMIN`.

### Vehicle Service (`/apps/vehicle-service`)
Manages vehicle registration and generates a unique deterministic hash per vehicle+owner pair. A vehicle must be registered before an inspection can be created.

### Inspection Service (`/apps/inspection-service`)
Manages inspection sessions, static form data, and fix lifecycle states. Will integrate with the Claude API in Phase 2 for AI-generated dynamic checklists.

### API Gateway (`/apps/api-gateway`)
Single entry point for all client requests. Routes traffic to internal services and handles rate limiting.

### Web (`/apps/web`)
Next.js frontend for owners, fixers, and admins.

---

## 🗺️ Roadmap

- [x] **Phase 1** — Monorepo, Docker Compose, Auth, Vehicle Registration, Static Forms, CI/CD
- [ ] **Phase 2** — AI-powered dynamic inspection forms, fix lifecycle, alerts
- [ ] **Phase 3** — OBD integration, AI diagnostic summaries
- [ ] **Phase 4** — Subscriptions (Stripe), CRM, owner portal
- [ ] **Phase 5** — Kubernetes, Terraform, production hardening

---

## 🏢 Built by Prodatek