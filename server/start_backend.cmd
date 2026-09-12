@echo off
rem GreenVision backend launcher — run BEFORE the demo and keep this
rem window open (closing it stops the server).
setlocal
cd /d "%~dp0"
set "PY=C:\Users\naya1\AppData\Local\Programs\Python\Python311\python.exe"
echo Starting GreenVision backend on http://127.0.0.1:5000 ...
echo (Do not close this window until the demo is finished.)
"%PY%" app.py
pause