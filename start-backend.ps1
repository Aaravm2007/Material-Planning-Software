Set-Location "$PSScriptRoot\backend"
pip install -r requirements.txt -q
python -m uvicorn main:app --reload --port 8000
