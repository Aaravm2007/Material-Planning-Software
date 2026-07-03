@echo off
echo WARNING: This will permanently DELETE all data in material_planning.db.
echo.
set /p confirm=Type YES to confirm:
if not "%confirm%"=="YES" (
  echo Cancelled. No changes made.
  pause
  exit /b
)
if exist "%~dp0backend\material_planning.db" (
  del /f "%~dp0backend\material_planning.db"
  echo Database deleted. Restart the backend to recreate empty tables.
) else (
  echo No database file found at backend\material_planning.db
)
pause
