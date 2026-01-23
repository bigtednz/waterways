# Quick Start Guide

## 1. Install Dependencies

```bash
npm install
```

## 2. Start Database

```bash
docker-compose up -d
```

Wait a few seconds for PostgreSQL to be ready.

## 3. Set Up Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed with sample data
npm run db:seed
```

## 4. Start Development Servers

**Terminal 1 - API:**
```bash
cd apps/api
npm run dev
```

**Terminal 2 - Web:**
```bash
cd apps/web
npm run dev
```

## 5. Login

- Open http://localhost:3000
- Email: `admin@waterways.com`
- Password: `admin123`

## Troubleshooting

### Database connection errors
- Make sure Docker is running
- Check that PostgreSQL container is up: `docker ps`
- Verify DATABASE_URL in `.env` matches docker-compose.yml

### Port already in use
- Change ports in `apps/api/.env` and `apps/web/vite.config.ts`
- Or stop other services using ports 3000/3001

### Prisma errors
- Run `npm run db:generate` after schema changes
- Run `npm run db:migrate` to apply migrations
