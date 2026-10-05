# Niko PostgreSQL restore
# WARNING: restoring replaces data in the target Niko database.
# Use only when intentionally migrating/restoring Niko data.

param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $RepoRoot '.env'

if (-not (Test-Path $EnvFile)) {
    throw ".env not found at $EnvFile"
}
if (-not (Test-Path $BackupFile)) {
    throw "Backup file not found: $BackupFile"
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

$pgRestore = (Get-Command pg_restore.exe -ErrorAction SilentlyContinue).Source
if (-not $pgRestore) {
    $candidates = @(
        'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe',
        'C:\Program Files\PostgreSQL\17\bin\pg_restore.exe',
        'C:\Program Files\PostgreSQL\16\bin\pg_restore.exe'
    )
    $pgRestore = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $pgRestore) {
    throw 'pg_restore.exe not found.'
}

$hostName = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { 'localhost' }
$port = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { '5432' }
$dbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { 'niko' }
$dbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { 'postgres' }

if (-not $env:POSTGRES_PASSWORD) {
    throw 'POSTGRES_PASSWORD is missing from .env'
}

Write-Host "WARNING: This will replace data in database '$dbName'."
$confirm = Read-Host "Type RESTORE to continue"
if ($confirm -ne 'RESTORE') {
    Write-Host 'Restore cancelled.'
    exit 0
}

$env:PGPASSWORD = $env:POSTGRES_PASSWORD
try {
    & $pgRestore --host=$hostName --port=$port --username=$dbUser --dbname=$dbName --clean --if-exists --no-owner --no-acl $BackupFile
    if ($LASTEXITCODE -ne 0) {
        throw "pg_restore failed with exit code $LASTEXITCODE"
    }
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "Niko database restore completed from: $BackupFile"
