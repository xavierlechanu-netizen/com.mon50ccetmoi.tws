@echo off
set JAVA_HOME=C:\Users\xavie\.bubblewrap\jdk\jdk-17.0.11+9
set ANDROID_HOME=C:\Users\xavie\AppData\Local\Android\Sdk
set PATH=%JAVA_HOME%\bin;%PATH%
set GRADLE_OPTS=-Xmx384m -XX:MaxMetaspaceSize=128m

echo [INFO] Lancement de la compilation v50.0.15 (Mode Basse Memoire)...
call gradlew bundleRelease --no-daemon
