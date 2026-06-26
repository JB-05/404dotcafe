@echo off
cd /d "%~dp0.."
python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install --upgrade pip
backend\.venv\Scripts\pip.exe install -r backend\requirements.txt
echo.
echo Backend venv ready. Run:
echo   backend\.venv\Scripts\activate
echo   cd backend
echo   uvicorn main:app --reload
