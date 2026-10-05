# Niko database backups

Niko's PostgreSQL database is separate from the GitHub code. These scripts create a portable PostgreSQL backup so the database can be moved from the PC to a future hosting provider.

## Backup

Run from the Niko folder:

\`\`\`powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1
\`\`\`

Backups are written to:

\`\`\`
D:\Niko-Backups
\`\`\`

The script keeps the newest 14 dump files.

## Restore / migration

On the destination machine, place the \`.dump\` file on the machine and make sure its PostgreSQL database exists. Then run:

\`\`\`powershell
powershell -ExecutionPolicy Bypass -File .\scripts\restore-db.ps1 -BackupFile "D:\Niko-Backups\niko_YYYYMMDD_HHMMSS.dump"
\`\`\`

The restore script asks for an explicit \`RESTORE\` confirmation because it replaces data in the target database.

**Never commit \`.env\` or database dump files to GitHub.**
