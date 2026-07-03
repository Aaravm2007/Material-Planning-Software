Set-Location "$PSScriptRoot\backend"
pip install -r requirements.txt -q
$env:ALLOWED_ORIGINS = "https://rocketlithum.co.in,https://www.rocketlithum.co.in,https://material-planning-software.vercel.app"
$env:FRONTEND_ORIGIN = "https://rocketlithum.co.in"
$env:DEV_MODE = "false"
python -m uvicorn main:app --reload --port 8000
