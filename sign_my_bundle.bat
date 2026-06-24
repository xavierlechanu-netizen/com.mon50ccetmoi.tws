@echo off
setlocal

REM Utilisation du JAVA_HOME par defaut du systeme
if not defined JAVA_HOME (
    set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
)

set "JARSIGNER=%JAVA_HOME%\bin\jarsigner.exe"

if not exist "%JARSIGNER%" (
    echo [ERREUR] Impossible de trouver jarsigner.exe dans %JAVA_HOME%\bin
    exit /b 1
)

set "AAB_UNSIGNED=app\build\outputs\bundle\release\app-release.aab"
set "AAB_SIGNED=C:\Users\xavie\Desktop\mon50ccetmoi_v100.00.08_SIGNED.aab"
set "KEYSTORE_PATH=new-upload-keystore.jks"
set "KEYSTORE_ALIAS=upload"

echo ======================================================================
echo    SIGNATURE DE L'APP BUNDLE POUR GOOGLE PLAY
echo ======================================================================
echo.
set "KEYPASS=Mon50cc2026!"

echo.
echo [INFO] Signature en cours...
"%JARSIGNER%" -keystore "%KEYSTORE_PATH%" -storepass "%KEYPASS%" -keypass "%KEYPASS%" -signedjar "%AAB_SIGNED%" "%AAB_UNSIGNED%" "%KEYSTORE_ALIAS%"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERREUR] La signature a echoue. Le mot de passe etait-il correct ?
    exit /b 1
)

echo.
echo ======================================================================
echo [SUCCES] Signature terminee ! 
echo Votre fichier SIGNE se trouve sur votre bureau :
echo mon50ccetmoi_v100.00.08_SIGNED.aab
echo ======================================================================
endlocal
