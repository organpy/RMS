@echo off
rem Double-click to install (first run only) and start RMS, then open it in the browser.
rem Everything stays inside this folder: Python packages in .venv, your data in data\.
rem Written with goto instead of ( ) blocks so folder names like "RMS (1)" do not break it.
rem This script is not signed, so Windows SmartScreen warns the first time it runs from a
rem download; after a successful first run it removes the download mark from itself.
setlocal EnableExtensions
title RMS
cd /d "%~dp0"

if exist "backend\__main__.py" goto unzipped
echo.
echo   This file was opened from inside the zip.
echo   Right-click the downloaded zip, choose "Extract All...", then open
echo   "Start RMS.bat" from the extracted folder.
goto fail
:unzipped

set "VPY=.venv\Scripts\python.exe"
if not exist "%VPY%" goto make_venv
"%VPY%" -c "import sys" >nul 2>nul
if not errorlevel 1 goto deps
echo The Python environment in .venv is broken, rebuilding it...
rmdir /s /q .venv

:make_venv
echo.
echo   First run: setting RMS up. This takes a minute or two and needs internet.
echo.
call :find_python
if defined PY goto have_python
echo   RMS needs Python 3.11 or newer, and it is not installed.
where winget >nul 2>nul
if errorlevel 1 goto no_python
choice /c YN /m "  Install Python 3.12 now (free, about 30 MB)"
if errorlevel 2 goto no_python
winget install -e --id Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements
call :find_python
if defined PY goto have_python
:no_python
echo.
echo   Install Python from https://www.python.org/downloads/
echo   (tick "Add python.exe to PATH" in the installer), then run this file again.
start "" "https://www.python.org/downloads/"
goto fail

:have_python
echo   Using %PY%
%PY% -m venv .venv
if errorlevel 1 goto venv_failed
set "FIRST_RUN=1"

:deps
rem Reinstall packages only when requirements.txt changed since the last install.
fc /b requirements.txt .venv\installed-requirements.txt >nul 2>nul
if not errorlevel 1 goto ui
echo   Installing the Python packages RMS uses...
"%VPY%" -m pip install --disable-pip-version-check -q -r requirements.txt
if errorlevel 1 goto pip_failed
copy /y requirements.txt .venv\installed-requirements.txt >nul

:ui
if exist "frontend\dist\index.html" goto shortcut
where npm >nul 2>nul
if errorlevel 1 goto no_ui
echo   Building the interface (developer copy)...
pushd frontend
call npm ci --silent
if errorlevel 1 goto build_failed
call npm run build --silent
if errorlevel 1 goto build_failed
popd
goto shortcut

:shortcut
if not defined FIRST_RUN goto run
set "RMS_DIR=%CD%"
rem Clear the "downloaded from the internet" mark so the warning does not come back.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -LiteralPath (Join-Path $env:RMS_DIR 'Start RMS.bat')" >nul 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=[Environment]::GetFolderPath('Desktop'); $s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $d 'RMS.lnk')); $s.TargetPath=(Join-Path $env:RMS_DIR 'Start RMS.bat'); $s.WorkingDirectory=$env:RMS_DIR; $s.IconLocation=(Join-Path $env:SystemRoot 'System32\shell32.dll')+',165'; $s.Save()" >nul 2>nul
if not errorlevel 1 echo   Added an "RMS" shortcut to your desktop.

:run
"%VPY%" -m backend --open
if errorlevel 1 goto fail
exit /b 0

:find_python
rem The Microsoft Store "python" stub fails the version check, so it is skipped.
set "PY="
call :try_python py -3
call :try_python python
call :try_python python3
for %%V in (313 312 311) do if exist "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe" call :try_python "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe"
exit /b 0

:try_python
if defined PY exit /b 0
%* -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>nul
if not errorlevel 1 set "PY=%*"
exit /b 0

:venv_failed
echo   Could not create the Python environment in "%CD%\.venv".
echo   Move the RMS folder somewhere you can write to, such as Documents, and try again.
goto fail
:pip_failed
echo   Installing packages failed. Check your internet connection and run this file again.
goto fail
:build_failed
popd
echo   Building the interface failed. See the messages above.
goto fail
:no_ui
echo   The interface is not built in this copy. Download the release zip, which
echo   includes it, or install Node.js 20+ from https://nodejs.org and run this again.
goto fail

:fail
echo.
pause
exit /b 1
