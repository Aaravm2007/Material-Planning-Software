@echo off
cd /d "%~dp0backend"
pip install -r requirements.txt -q
set ALLOWED_ORIGINS=https://rocketlithum.co.in,https://www.rocketlithum.co.in,https://material-planning-software.vercel.app
set FRONTEND_ORIGIN=https://rocketlithum.co.in
set DEV_MODE=false
python -m uvicorn main:app --port 8000
