Add-Type -AssemblyName System.Drawing
$imagePath = "C:\Users\xavie\.gemini\antigravity-ide\brain\085ffde3-abf3-4461-b5de-73d0eb497c54\app_icon_mon50cc_1782674876236.png"
$outputPath = "C:\Users\xavie\.gemini\antigravity-ide\brain\085ffde3-abf3-4461-b5de-73d0eb497c54\app_icon_98x98.png"

$img = [System.Drawing.Image]::FromFile($imagePath)
$targetWidth = 98
$targetHeight = 98

$bmp = New-Object System.Drawing.Bitmap $targetWidth, $targetHeight
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

$destRect = New-Object System.Drawing.Rectangle 0, 0, $targetWidth, $targetHeight
$graphics.DrawImage($img, $destRect)

$graphics.Dispose()
$img.Dispose()

$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "Icon resized and saved to $outputPath"
