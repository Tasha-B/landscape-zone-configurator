# Landscape Zone Configurator

Interactive office floor plan for planning botanical design zone by zone.
The SVG map is ported from [Cairn Botanics](https://github.com/Tasha-B/cairn-botanics)
and is being grown into a fullstack editor.

## Stack

| Layer    | Tech                                              | Status  |
| -------- | ------------------------------------------------- | ------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion | ✅ |
| Backend  | NestJS, REST + WebSockets                         | planned |
| Database | PostgreSQL                                        | planned |
| DevOps   | Docker, docker-compose, GitHub Actions            | planned |

## Structure

```
frontend/   React app (Vite)
backend/    NestJS API (planned)
```

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Other scripts: `npm run build`, `npm run lint`, `npm run preview`.
