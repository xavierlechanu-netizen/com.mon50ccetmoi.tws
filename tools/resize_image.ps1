Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("C:\Users\xavie\.gemini\antigravity-ide\brain\085ffde3-abf3-4461-b5de-73d0eb497c54\youtube_banner_mon50cc_1782674359747.png")

# Target dimensions: 2560 x 1440 (recommended by YouTube, well above 2048x1152)
$targetWidth = 2560
$targetHeight = 1440

$bmp = New-Object System.Drawing.Bitmap $targetWidth, $targetHeight
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

# Source crop rectangle: 16:9 ratio of 1024 is 1024x576
$srcWidth = 1024
$srcHeight = 576
$srcX = 0
$srcY = ($img.Height - $srcHeight) / 2

$srcRect = New-Object System.Drawing.Rectangle $srcX, $srcY, $srcWidth, $srcHeight
$destRect = New-Object System.Drawing.Rectangle 0, 0, $targetWidth, $targetHeight

$graphics.DrawImage($img, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

$graphics.Dispose()
$img.Dispose()

$outputPath = "C:\Users\xavie\.gemini\antigravity-ide\brain\085ffde3-abf3-4461-b5de-73d0eb497c54\youtube_banner_2560x1440.png"
$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "Image resized and saved to $outputPath"
