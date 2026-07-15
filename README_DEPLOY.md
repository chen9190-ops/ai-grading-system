# Production deployment: GitHub Actions → Aliyun ECS

The production workflow deploys the exact commit pushed to `main`, creates a verified PostgreSQL backup, builds the application, applies Prisma migrations, reloads PM2, and checks both the application and database through `/api/health`.

## Required GitHub production secrets

Configure these in **Settings → Environments → production → Environment secrets**:

| Secret | Description |
| --- | --- |
| `ECS_HOST` | ECS public IP or hostname |
| `ECS_SSH_PORT` | SSH port, normally `22` |
| `ECS_USER` | Deployment user |
| `ECS_SSH_KEY` | Private SSH key |
| `ECS_HOST_FINGERPRINT` | ECS SSH host-key SHA256 fingerprint |
| `PROJECT_DIR` | Repository path, for example `/var/www/ai-grading-system` |

Database passwords and Dify keys are intentionally **not** passed through the SSH action. They remain in the server-side `.env.production` file with mode `600`.

Get the ECS host fingerprint from a trusted network before saving it:

```bash
ssh-keyscan -p 22 your.ecs.host 2>/dev/null | ssh-keygen -lf - -E sha256
```

## Server environment

Create `/var/www/ai-grading-system/.env.production` from `.env.production.example`, fill all required values, then protect it:

```bash
chmod 600 /var/www/ai-grading-system/.env.production
```

`DATABASE_URL` is preferred and is used by Prisma. The backup scripts automatically remove Prisma-only URL parameters such as `schema` before calling `pg_dump` or `psql`.

If `DATABASE_URL` is empty, the scripts can construct it from:

```text
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME
DB_SCHEMA
```

Do not leave the example `DATABASE_URL` in place when using the individual `DB_*` variables.

## First server installation

The supported bootstrap path for an Ubuntu ECS host is:

```bash
sudo REPO_URL=git@github.com:OWNER/ai-grading-system.git \
  APP_DIR=/var/www/ai-grading-system \
  DOMAIN_NAME=example.edu.cn \
  bash deploy.sh
```

The script installs Node.js, Nginx, PM2 and `postgresql-client`. On the first run it creates `.env.production` and stops so credentials can be configured safely. Rerun it after editing the environment file.

For an already-provisioned Alibaba Cloud Linux/CentOS host, install Node.js, Nginx and PM2 using the distribution package manager, then run:

```bash
bash scripts/ensure-postgres-client.sh
bash update.sh
```

## Deployment order

The release script performs these steps:

1. Load and validate `.env.production`.
2. Ensure `pg_dump`, `pg_restore`, and `psql` are installed.
3. Verify the PostgreSQL connection.
4. Create and validate a compressed custom-format backup.
5. Install exactly the versions in `package-lock.json` using `npm ci`.
6. Generate Prisma Client.
7. Build Next.js with the Git commit as deployment/build ID.
8. Run `prisma migrate deploy`.
9. Start or restart PM2 with refreshed environment variables.
10. Poll `/api/health` until both the application and database are healthy.

Backups are stored in `/var/backups/ai-grading-system`, mode `600`, with a default retention of 30 days and 30 files.

## Rollback behavior

If deployment fails, the application working tree is reset to the previous commit. If dependencies or build output may have changed, the previous commit is reinstalled, rebuilt, and restarted through PM2.

The database is **not automatically restored** after a failed application deployment. Automatic restore can delete valid writes that occurred after the backup. Prisma production migrations must therefore remain backward-compatible with the previous application release. The backup path is printed in the deployment log for controlled recovery.

Manual database recovery:

```bash
cd /var/www/ai-grading-system
CONFIRM_RESTORE=YES bash scripts/restore-db.sh /var/backups/ai-grading-system/backup_YYYYMMDDTHHMMSSZ.dump
```

The restore script also supports legacy plain `.sql` backups.

## Manual deployment

```bash
cd /var/www/ai-grading-system
bash update.sh
```

Manual backup:

```bash
cd /var/www/ai-grading-system
bash scripts/backup-db.sh
```

Install the daily 03:00 backup cron job:

```bash
cd /var/www/ai-grading-system
sudo bash scripts/install-backup-cron.sh
```

## Server verification

```bash
cd /var/www/ai-grading-system
bash scripts/check-server.sh
pm2 status
pm2 logs ai-grading-system --lines 100
curl --fail http://127.0.0.1:3000/api/health
nginx -t
```

## `pg_dump` troubleshooting

If the release reports that PostgreSQL client tools are unavailable:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y postgresql-client

# Alibaba Cloud Linux/CentOS
sudo dnf install -y postgresql || sudo yum install -y postgresql
```

Confirm:

```bash
pg_dump --version
psql --version
pg_restore --version
```

The `pg_dump` major version must be equal to or newer than the PostgreSQL server major version. If the server is newer, install the matching client package, for example `postgresql-client-16`.

## Prisma migration troubleshooting

`prisma.config.ts` intentionally does not read `.env.production`. Deployment scripts explicitly source the file before every Prisma command. For manual debugging:

```bash
cd /var/www/ai-grading-system
set -a
source .env.production
set +a
npx prisma migrate status
npx prisma migrate deploy
```

Never use `prisma migrate dev` on the production server.
