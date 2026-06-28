Add-Type -AssemblyName System.Drawing
$sourcePath = "C:\Users\xavie\.gemini\antigravity-ide\brain\085ffde3-abf3-4461-b5de-73d0eb497c54\app_icon_mon50cc_1782674876236.png"
$destPath = "C:\Users\xavie\.gemini\antigravity-ide\brain\085ffde3-abf3-4461-b5de-73d0eb497c54\youtube_watermark_150x150.png"
$img = [System.Drawing.Image]::FromFile($sourcePath)
$bmp = New-Object System.Drawing.Bitmap(150, 150)
$graph = [System.Drawing.Graphics]::FromImage($bmp)
$graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$rect = New-Object System.Drawing.Rectangle(0, 0, 150, 150)
$graph.DrawImage($img, $rect)
$bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
$graph.Dispose()
$bmp.Dispose()
$img.Dispose()
Write-Output "Watermark created at $destPath"
