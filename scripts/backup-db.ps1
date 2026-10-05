# Niko PostgreSQL backup
# Creates a portable PostgreSQL custom-format dump that can be restored on another server.

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $RepoRoot '.env'
$BackupDir = 'D:\Niko-Backups'

if (-not (Test-Path $EnvFile)) {
    throw ".env not found at $EnvFile"
}

Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#') -and $line -match '^([^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
}

$pgDump = (Get-Command pg_dump.exe -ErrorAction SilentlyContinue).Source
if (-not $pgDump) {
    $candidates = @(
        'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe',
        'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe',
        'C:\Program Files\PostgreSQL\16\bin\pg_dump.exe'
    )
    $pgDump = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $pgDump) {
    throw 'pg_dump.exe not found. Install PostgreSQL client tools or add pg_dump to PATH.'
}

$hostName = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { 'localhost' }
$port = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { '5432' }
$dbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { 'niko' }
$dbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { 'postgres' }

if (-not $env:POSTGRES_PASSWORD) {
    throw 'POSTGRES_PASSWORD is missing from .env'
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupFile = Join-Path $BackupDir "niko_$timestamp.dump"

$env:PGPASSWORD = $env:POSTGRES_PASSWORD
try {
    & $pgDump --host=$hostName --port=$port --username=$dbUser --dbname=$dbName --format=custom --compress=9 --no-owner --no-acl --file=$backupFile
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed with exit code $LASTEXITCODE"
    }
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Get-ChildItem $BackupDir -Filter 'niko_*.dump' -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip 14 |
    Remove-Item -Force

Write-Host "Niko database backup created: $backupFile"
