# IAE Event Flow Backend (NestJS)

This backend is a NestJS API service added to the existing frontend workspace.

## 1) Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and fill your real DB password:

```env
PORT=3000
DB_HOST=192.168.100.181
DB_PORT=1433
DB_USERNAME=SA
DB_PASSWORD=<PASTE_YOUR_PASSWORD_HERE>
DB_NAME=master
DB_ENCRYPT=false
DB_TRUST_SERVER_CERT=true
```

## 2) Run backend

```bash
cd backend
npm run start:dev
```

## 3) Test API and DB connection

- API health: `http://localhost:3000/api`
- DB health: `http://localhost:3000/api/db-health`

Expected DB health response:

```json
{
  "message": "NestJS backend is running",
  "service": "iae-event-flow-backend",
  "timestamp": "2026-04-08T00:00:00.000Z",
  "db": {
    "connected": true
  }
}
```

## 4) MSSQL access (SQLCMD)

From the DB server itself:

```bash
sqlcmd -S localhost -U SA -P '<PASTE_YOUR_SA_PASSWORD>' -C
```

From your app VM/project machine (remote connection):

```bash
sqlcmd -S 192.168.100.181,1433 -U SA -P '<PASTE_YOUR_SA_PASSWORD>' -C
```

Inside `sqlcmd`, run:

```sql
SELECT @@VERSION;
GO
SELECT name FROM sys.databases;
GO
```

Exit sqlcmd:

```sql
QUIT
```

## 5) If remote connection fails

On DB server, verify SQL Server listens on 1433 and firewall allows inbound 1433.

Quick network test from app VM:

```bash
nc -zv 192.168.100.181 1433
```

If this is blocked, ask infra team to open TCP port `1433` from app VM to DB VM.
