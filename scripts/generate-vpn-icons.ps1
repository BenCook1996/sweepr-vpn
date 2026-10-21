Add-Type -AssemblyName System.Drawing

function New-VpnShieldBitmap {
    param(
        [int]$Size = 256,
        [string]$Theme = "emerald"
    )

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $s = $Size / 100.0

    $bgStart = [System.Drawing.ColorTranslator]::FromHtml("#10b981")
    $bgEnd   = [System.Drawing.ColorTranslator]::FromHtml("#047857")
    $fgPrim  = [System.Drawing.Color]::White
    $fgSec   = [System.Drawing.ColorTranslator]::FromHtml("#a7f3d0")
    $borderCol = [System.Drawing.Color]::FromArgb(72, 255, 255, 255)

    # 1. Rounded Squircle Background (x=4, y=4, w=92, h=92, rx=22)
    $p1 = New-Object System.Drawing.PointF 0, 0
    $p2 = New-Object System.Drawing.PointF $Size, $Size
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $p1, $p2, $bgStart, $bgEnd

    $m = [float](4.0 * $s)
    $w = [float](92.0 * $s)
    $r = [float](44.0 * $s)
    $bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $bgPath.AddArc($m, $m, $r, $r, 180, 90)
    $bgPath.AddArc($m + $w - $r, $m, $r, $r, 270, 90)
    $bgPath.AddArc($m + $w - $r, $m + $w - $r, $r, $r, 0, 90)
    $bgPath.AddArc($m, $m + $w - $r, $r, $r, 90, 90)
    $bgPath.CloseFigure()
    $g.FillPath($bgBrush, $bgPath)
    $borderPen = New-Object System.Drawing.Pen $borderCol, ([float]([Math]::Max(1.0, 2.0 * $s)))
    $g.DrawPath($borderPen, $bgPath)
    $borderPen.Dispose()
    $bgPath.Dispose()
    $bgBrush.Dispose()

    # 2. Shield Outline: M50 16 L79 27 V49 C79 67.5 66.5 80.5 50 86 C33.5 80.5 21 67.5 21 49 V27 Z
    $shieldPen = New-Object System.Drawing.Pen $fgPrim, ([float]([Math]::Max(1.5, 5.5 * $s)))
    $shieldPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $shieldPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $shieldPath.AddLine([float](50.0 * $s), [float](16.0 * $s), [float](79.0 * $s), [float](27.0 * $s))
    $shieldPath.AddLine([float](79.0 * $s), [float](27.0 * $s), [float](79.0 * $s), [float](49.0 * $s))
    $shieldPath.AddBezier(
        [float](79.0 * $s), [float](49.0 * $s),
        [float](79.0 * $s), [float](67.5 * $s),
        [float](66.5 * $s), [float](80.5 * $s),
        [float](50.0 * $s), [float](86.0 * $s)
    )
    $shieldPath.AddBezier(
        [float](50.0 * $s), [float](86.0 * $s),
        [float](33.5 * $s), [float](80.5 * $s),
        [float](21.0 * $s), [float](67.5 * $s),
        [float](21.0 * $s), [float](49.0 * $s)
    )
    $shieldPath.AddLine([float](21.0 * $s), [float](49.0 * $s), [float](21.0 * $s), [float](27.0 * $s))
    $shieldPath.CloseFigure()
    $g.DrawPath($shieldPen, $shieldPath)
    $shieldPath.Dispose()
    $shieldPen.Dispose()

    # 3. Wi-Fi Radar Waves Inside Shield
    $wave1Pen = New-Object System.Drawing.Pen $fgSec, ([float]([Math]::Max(1.2, 4.5 * $s)))
    $wave1Pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $wave1Pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawArc($wave1Pen, [float](28.0 * $s), [float](32.0 * $s), [float](44.0 * $s), [float](44.0 * $s), 215, 110)
    $wave1Pen.Dispose()

    $wave2Pen = New-Object System.Drawing.Pen $fgPrim, ([float]([Math]::Max(1.2, 4.5 * $s)))
    $wave2Pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $wave2Pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawArc($wave2Pen, [float](36.0 * $s), [float](42.0 * $s), [float](28.0 * $s), [float](28.0 * $s), 215, 110)
    $wave2Pen.Dispose()

    # Center Radar Dot
    $dotBrush = New-Object System.Drawing.SolidBrush $fgPrim
    $rDot = [float]([Math]::Max(1.5, 4.5 * $s))
    $g.FillEllipse($dotBrush, [float](50.0 * $s - $rDot), [float](63.0 * $s - $rDot), [float]($rDot * 2), [float]($rDot * 2))
    $dotBrush.Dispose()

    # 4. Signature Sweepr Sparkle Star at (73, 27)
    $starPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $cx = 73.0 * $s
    $cy = 27.0 * $s
    $topY = 19.0 * $s
    $botY = 35.0 * $s
    $leftX = 65.0 * $s
    $rightX = 81.0 * $s
    $starPath.AddBezier([float]$cx, [float]$topY, [float]$cx, [float]($topY + 5.3*$s), [float]($rightX - 5.3*$s), [float]$cy, [float]$rightX, [float]$cy)
    $starPath.AddBezier([float]$rightX, [float]$cy, [float]($rightX - 5.3*$s), [float]$cy, [float]$cx, [float]($botY - 5.3*$s), [float]$cx, [float]$botY)
    $starPath.AddBezier([float]$cx, [float]$botY, [float]$cx, [float]($botY - 5.3*$s), [float]($leftX + 5.3*$s), [float]$cy, [float]$leftX, [float]$cy)
    $starPath.AddBezier([float]$leftX, [float]$cy, [float]($leftX + 5.3*$s), [float]$cy, [float]$cx, [float]($topY + 5.3*$s), [float]$cx, [float]$topY)
    $starPath.CloseFigure()
    $starBrush = New-Object System.Drawing.SolidBrush $fgPrim
    $g.FillPath($starBrush, $starPath)
    $starBrush.Dispose()
    $starPath.Dispose()

    $g.Dispose()
    return $bmp
}

function Save-MultiSizeVpnIco {
    param([string]$Path)
    $sizes = @(16, 32, 48, 64, 256)
    $pngBuffers = @()
    foreach ($sz in $sizes) {
        $bmp = New-VpnShieldBitmap -Size $sz
        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngBuffers += ,($ms.ToArray())
        $ms.Dispose()
        $bmp.Dispose()
    }

    $fs = [System.IO.File]::Open($Path, [System.IO.FileMode]::Create)
    $bw = New-Object System.IO.BinaryWriter($fs)
    $bw.Write([uint16]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]$sizes.Count)

    $offset = 6 + (16 * $sizes.Count)
    for ($i = 0; $i -lt $sizes.Count; $i++) {
        $sz = $sizes[$i]
        $buf = $pngBuffers[$i]
        $wByte = if ($sz -ge 256) { [byte]0 } else { [byte]$sz }
        $bw.Write($wByte)
        $bw.Write($wByte)
        $bw.Write([byte]0)
        $bw.Write([byte]0)
        $bw.Write([uint16]1)
        $bw.Write([uint16]32)
        $bw.Write([uint32]$buf.Length)
        $bw.Write([uint32]$offset)
        $offset += $buf.Length
    }
    for ($i = 0; $i -lt $sizes.Count; $i++) {
        $bw.Write($pngBuffers[$i])
    }
    $bw.Flush()
    $bw.Close()
    $fs.Close()
}

$root = "c:\Users\Benjamin\Downloads\vpn"
Save-MultiSizeVpnIco -Path "$root\desktop-client\app-icon.ico"
Save-MultiSizeVpnIco -Path "$root\website\favicon.ico"
$bmp256 = New-VpnShieldBitmap -Size 256
$bmp256.Save("$root\desktop-client\app-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp256.Dispose()
$bmp64 = New-VpnShieldBitmap -Size 64
$bmp64.Save("$root\website\favicon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp64.Dispose()
$bmp32 = New-VpnShieldBitmap -Size 32
$bmp32.Save("$root\website\icon-32x32.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp32.Dispose()
Write-Output "Generated multi-size SWEEPR VPN Emerald Shield .ico and .png successfully!"
