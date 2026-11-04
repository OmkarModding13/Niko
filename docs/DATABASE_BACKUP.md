# Niko database backups

Niko's PostgreSQL database is separate from the GitHub repository and the bot hosting filesystem. Keep backups outside the bot's deploy directory so a redeploy cannot erase them.

## Create a backup

Set `POSTGRES_URL` in the environment and ensure PostgreSQL's `pg_dump` utility is installed:

```bash
npm run backup:db
```

Optional settings:
- `BACKUP_DIR`: destination directory (defaults to `./backups`)
- `BACKUP_RETENTION_DAYS`: number of days to retain local dump files (defaults to 14)

## Restore a backup

Set `POSTGRES_URL` or `POSTGRES_RESTORE_URL` to the target database. Then run:

```bash
npm run restore:db -- --input ./backups/niko-backup-YYYYMMDD-HHMMSS.dump --confirm
```

Restore replaces matching database objects. Use a separate target database when testing a restore. The `--drop-schema` option is destructive and should only be used when intentionally rebuilding the target schema.

**Important:** A backup stored only on the hosting instance may be lost with that instance or its volume. Copy dumps to durable external storage and never commit `.env` files or database dumps to GitHub.
