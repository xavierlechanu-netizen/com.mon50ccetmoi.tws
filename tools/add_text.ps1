Add-Type -AssemblyName System.Drawing
$imagePath = "C:\Users\xavie\.gemini\antigravity-ide\brain\085ffde3-abf3-4461-b5de-73d0eb497c54\youtube_banner_2560x1440.png"
$outputPath = "C:\Users\xavie\.gemini\antigravity-ide\brain\085ffde3-abf3-4461-b5de-73d0eb497c54\youtube_banner_final.png"

$img = [System.Drawing.Image]::FromFile($imagePath)
$width = 2560
$height = 1440

$bmp = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
$g.DrawImage($img, 0, 0)

$text = "mon 50cc et moi"
$font = New-Object System.Drawing.Font("Segoe UI", 120, [System.Drawing.FontStyle]::Bold)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center

$subtitle = "Le Copilote IA des Scooters et VSP"
$subFont = New-Object System.Drawing.Font("Segoe UI", 40, [System.Drawing.FontStyle]::Regular)

# Position adjustments
$rectHeight = 1440 - 120
$rect = New-Object System.Drawing.RectangleF(0, 0, $width, $rectHeight)
$subRect = New-Object System.Drawing.RectangleF(0, 150, $width, $height)

# Shadow/Glow Brush
$shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(180, 0, 0, 0))
$cyanBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#00d2ff"))
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)

# Draw text shadows
$shadowRect = New-Object System.Drawing.RectangleF(8, 8, $width, $rectHeight)
$g.DrawString($text, $font, $shadowBrush, $shadowRect, $format)

$subShadowRect = New-Object System.Drawing.RectangleF(4, 154, $width, $height)
$g.DrawString($subtitle, $subFont, $shadowBrush, $subShadowRect, $format)

# Draw text
$g.DrawString($text, $font, $whiteBrush, $rect, $format)
$g.DrawString($subtitle, $subFont, $cyanBrush, $subRect, $format)

$g.Dispose()
$img.Dispose()

$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "Image with text saved to $outputPath"
