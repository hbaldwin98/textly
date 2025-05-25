@echo off
setlocal enabledelayedexpansion

:: Default to starting all components if no arguments provided
if "%~1"=="" (
    echo Starting all components...
    echo Starting Go Server...
    start cmd /k "cd server && go run main.go serve --https=0.0.0.0:8080"

    echo Starting Client Application...
    start cmd /k "cd web && npm run dev"
    exit /b
)

:: Process each argument
:loop
if "%~1"=="" goto :eof

 if /i "%~1"=="server" (
    echo Starting Go Server...
    start cmd /k "cd server && go run main.go serve --https=0.0.0.0:8080"
) else if /i "%~1"=="client" (
    echo Starting Client Application...
    start cmd /k "cd web && npm run dev"
) else (
    echo Unknown component: %~1
    echo Usage: start.bat [go|pocketbase|client]...
    echo If no arguments provided, starts all components.
    exit /b 1
)

shift
goto loop

    echo Unknown component: %~1
    echo Usage: start.bat [go|pocketbase|client]...
    echo If no arguments provided, starts all components.
    exit /b 1
)

shift
goto loop

echo ============================================
echo      Starting Textly...
echo ============================================