Set-Location "$PSScriptRoot\backend"
pip install -r requirements.txt -q
$env:ALLOWED_ORIGINS = "https://material-planning-software.vercel.app"
python -m uvicorn main:app --reload --port 8000
