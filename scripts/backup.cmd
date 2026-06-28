@echo off
REM Lanzador del backup para el Programador de tareas de Windows.
echo ==== Backup %DATE% %TIME% ==== >> "%~dp0backup.log"
cd /d "C:\Users\cuent\Documents\Proyectos\Proyecto Biblioteca Cordillera"
call npm run backup >> "%~dp0backup.log" 2>&1
echo Resultado (codigo): %ERRORLEVEL% >> "%~dp0backup.log"
echo. >> "%~dp0backup.log"
