# Fix Job Mock Service

Lightweight mock Fix Job service to help frontend and gateway development.

Run locally:

1. cd apps/fix-job-service
2. npm install
3. npm start

The service listens on port 3010 by default and exposes:

- `GET /fix-jobs` — returns `{ statusCode:200, data: FixJob[], pagination: {...} }`
- `GET /fix-jobs/:id` — returns single fix job object or 404
- `GET /health` — basic health check

Integration notes:

- To test the frontend against this service, either update your gateway proxy to forward `/fix-jobs` to `http://host.docker.internal:3010` (if running in Docker) or change `apps/web` API base to point to `http://localhost:3010` temporarily.
