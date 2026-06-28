Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("C:\Users\xavie\.gemini\antigravity-ide\brain\085ffde3-abf3-4461-b5de-73d0eb497c54\youtube_banner_mon50cc_1782674359747.png")
Write-Output ("Width: " + $img.Width + " Height: " + $img.Height)
$img.Dispose()
