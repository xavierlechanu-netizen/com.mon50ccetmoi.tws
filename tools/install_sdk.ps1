New-Item -ItemType Directory -Force -Path "C:\Android\cmdline-tools\latest"
Invoke-WebRequest -Uri "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip" -OutFile "cmdline.zip"
Expand-Archive -Path "cmdline.zip" -DestinationPath "C:\Android\cmdline-tools\tmp" -Force
Move-Item "C:\Android\cmdline-tools\tmp\cmdline-tools\*" "C:\Android\cmdline-tools\latest\" -Force
Remove-Item -Recurse -Force "C:\Android\cmdline-tools\tmp"
Remove-Item "cmdline.zip"
Write-Output y | C:\Android\cmdline-tools\latest\bin\sdkmanager.bat "platforms;android-35" "build-tools;35.0.0" "platform-tools"
