@echo off
setlocal

schtasks /Create /TN "Niko Database Backup" /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File D:\Niko\scripts\backup-db.ps1" /SC DAILY /ST 03:00 /RU SYSTEM /F

if errorlevel 1 (
  echo Failed to create the Niko Database Backup scheduled task.
  exit /b 1
)

echo Niko Database Backup is scheduled daily at 03:00.
echo You can test it with:
echo schtasks /Run /TN "Niko Database Backup"
