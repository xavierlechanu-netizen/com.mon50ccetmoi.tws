Add-Type -AssemblyName System.Drawing
$baseImgPath = "C:\Users\xavie\.gemini\antigravity-ide\brain\085ffde3-abf3-4461-b5de-73d0eb497c54\app_icon_mon50cc_1782674876236.png"
$img = [System.Drawing.Image]::FromFile($baseImgPath)

$sizes = @{
    "mdpi" = 48
    "hdpi" = 72
    "xhdpi" = 96
    "xxhdpi" = 144
    "xxxhdpi" = 192
}

$dirs = @(
    "C:\Users\xavie\.gemini\antigravity-ide\scratch\com.mon50ccetmoi.tws-main\app\src\main\res",
    "C:\Users\xavie\.gemini\antigravity-ide\scratch\com.mon50ccetmoi.tws-main\android-app\android\app\src\main\res"
)

foreach ($resDir in $dirs) {
    if (Test-Path $resDir) {
        foreach ($sz in $sizes.Keys) {
            $dim = $sizes[$sz]
            $mipmapDir = Join-Path $resDir "mipmap-$sz"
            if (Test-Path $mipmapDir) {
                $bmp = New-Object System.Drawing.Bitmap $dim, $dim
                $g = [System.Drawing.Graphics]::FromImage($bmp)
                $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
                $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $destRect = New-Object System.Drawing.Rectangle 0, 0, $dim, $dim
                $g.DrawImage($img, $destRect)
                $g.Dispose()

                $icLauncher = Join-Path $mipmapDir "ic_launcher.png"
                if (Test-Path $icLauncher) { $bmp.Save($icLauncher, [System.Drawing.Imaging.ImageFormat]::Png) }

                $icLauncherRound = Join-Path $mipmapDir "ic_launcher_round.png"
                if (Test-Path $icLauncherRound) { $bmp.Save($icLauncherRound, [System.Drawing.Imaging.ImageFormat]::Png) }

                $icLauncherForeground = Join-Path $mipmapDir "ic_launcher_foreground.png"
                if (Test-Path $icLauncherForeground) { $bmp.Save($icLauncherForeground, [System.Drawing.Imaging.ImageFormat]::Png) }

                $icMaskable = Join-Path $mipmapDir "ic_maskable.png"
                if (Test-Path $icMaskable) { $bmp.Save($icMaskable, [System.Drawing.Imaging.ImageFormat]::Png) }

                $bmp.Dispose()
            }
        }
    }
}
$img.Dispose()
Write-Output "Icons updated!"
