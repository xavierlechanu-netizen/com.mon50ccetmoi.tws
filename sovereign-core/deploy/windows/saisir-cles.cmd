@echo off
rem Saisie des cles du VPS depuis Windows (fenetre a cases). Voir saisir-cles.ps1.
rem Exemples : saisir-cles.cmd -Groupe stockage   /   saisir-cles.cmd -Noms OVH_SMS_SENDER
rem Le script est lu en UTF-8 explicitement : PowerShell 5.1 lirait sinon ses accents de travers.
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$s = [IO.File]::ReadAllText('%~dp0saisir-cles.ps1', [Text.Encoding]::UTF8); & ([scriptblock]::Create($s)) %*"
