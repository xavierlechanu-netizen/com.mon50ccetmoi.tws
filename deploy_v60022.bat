@echo off
setlocal

REM ─────────────────────────────────────────────────────────────────
REM  mon50ccetmoi — Deploy v60.0.22 (fix GPS geolocation)
REM  Usage : double-cliquer ou lancer depuis le dossier du projet
REM ─────────────────────────────────────────────────────────────────

REM ── Environnement ────────────────────────────────────────────────
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=C:\Users\xavie\AppData\Local\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set "GRADLE_OPTS=-Xmx512m -XX:MaxMetaspaceSize=192m"

REM ── Keystore ─────────────────────────────────────────────────────
set "KEYSTORE_PATH=upload-keystore.jks"
set "KEYSTORE_ALIAS=upload"
set "KEYSTORE_PASS=%ENV_KEYSTORE_PASS%"
set "KEY_PASS=%ENV_KEY_PASS%"

REM ── Chemins de sortie ────────────────────────────────────────────
set "AAB_UNSIGNED=app\build\outputs\bundle\release\app-release.aab"
set "AAB_SIGNED=app-release-bundle.aab"
set "VERSION=60.0.22"

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║   mon50ccetmoi — Deploy v%VERSION% (fix GPS)          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

REM ── ÉTAPE 1 : Build ──────────────────────────────────────────────
echo [1/3] Compilation du bundle Release...
call gradlew.bat bundleRelease --no-daemon
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERREUR] La compilation a echoue. Verifiez les logs Gradle ci-dessus.
    pause
    exit /b 1
)
echo [OK] Build reussi.
echo.

REM ── ÉTAPE 2 : Signature ──────────────────────────────────────────
echo [2/3] Signature du bundle avec le keystore de production...
if not exist "%AAB_UNSIGNED%" (
    echo [ERREUR] Fichier AAB introuvable : %AAB_UNSIGNED%
    pause
    exit /b 1
)

jarsigner ^
    -verbose ^
    -keystore "%KEYSTORE_PATH%" ^
    -storepass "%KEYSTORE_PASS%" ^
    -keypass "%KEY_PASS%" ^
    -signedjar "%AAB_SIGNED%" ^
    "%AAB_UNSIGNED%" ^
    "%KEYSTORE_ALIAS%"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERREUR] La signature a echoue. Verifiez le keystore et le mot de passe.
    pause
    exit /b 1
)
echo [OK] Bundle signe : %AAB_SIGNED%
echo.

REM ── ÉTAPE 3 : Publication Play Store ─────────────────────────────
echo [3/3] Publication sur le Play Store (track : internal)...
set "BUBBLEWRAP_KEYSTORE_PASSWORD=%KEYSTORE_PASS%"
set "BUBBLEWRAP_KEY_PASSWORD=%KEY_PASS%"

cmd /c bubblewrap play publish --aabPath "%AAB_SIGNED%"
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ╔══════════════════════════════════════════════════════════╗
    echo ║  [SUCCESS] v%VERSION% publiee sur le Play Store !     ║
    echo ║  GPS fix : ACCESS_FINE_LOCATION + ACCESS_COARSE        ║
    echo ╚══════════════════════════════════════════════════════════╝
) else (
    echo.
    echo [ERREUR] La publication a echoue.
    echo Vous pouvez uploader manuellement le fichier : %AAB_SIGNED%
    echo sur https://play.google.com/console
)

echo.
pause
endlocal
