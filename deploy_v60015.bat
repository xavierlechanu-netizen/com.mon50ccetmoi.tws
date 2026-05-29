@echo off
set JAVA_HOME=C:\Users\xavie\.bubblewrap\jdk\jdk-17.0.11+9
set ANDROID_HOME=C:\Users\xavie\AppData\Local\Android\Sdk
set PATH=%JAVA_HOME%\bin;%PATH%
set "BUBBLEWRAP_KEYSTORE_PASSWORD=%KEYSTORE_PASS%"
set "BUBBLEWRAP_KEY_PASSWORD=%KEY_PASS%"
set GRADLE_OPTS=-Xmx384m -XX:MaxMetaspaceSize=128m

echo [INFO] Demarrage de la compilation v60.0.15...
cmd /c bubblewrap build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] La compilation a echoue.
    exit /b %ERRORLEVEL%
)

echo [INFO] Publication sur Play Console...
cmd /c bubblewrap play publish --aabPath ./app-release-bundle.aab
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Publication terminee !
) else (
    echo [ERROR] La publication a echoue.
)
