@echo off
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
set "JARSIGNER=%JAVA_HOME%\bin\jarsigner.exe"
set "KEYSTORE_PATH=D:\keystore\new-upload-keystore.jks"
set "KEYPASS=Mon50cc2026!"
set "AAB_UNSIGNED=app\build\outputs\bundle\release\app-release.aab"
set "AAB_SIGNED=C:\Users\xavie\Desktop\mon50ccetmoi_101.00.00_SIGNED.aab"

"%JARSIGNER%" -keystore "%KEYSTORE_PATH%" -storepass "%KEYPASS%" -keypass "%KEYPASS%" -signedjar "%AAB_SIGNED%" "%AAB_UNSIGNED%" upload
