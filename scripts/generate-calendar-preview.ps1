Add-Type -AssemblyName System.Drawing

$destination = Join-Path $PSScriptRoot '..\calendar-widget\preview.png'
$bitmap = [System.Drawing.Bitmap]::new(640, 360)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$background = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(12, 30, 44))
$card = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(24, 57, 76))
$white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(247, 244, 233))
$muted = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(157, 217, 228))
$today = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 226, 163))
$dark = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(23, 37, 50))
$labelFont = [System.Drawing.Font]::new('Segoe UI', 13)
$titleFont = [System.Drawing.Font]::new('Segoe UI', 28)
$dayFont = [System.Drawing.Font]::new('Segoe UI', 13)
try {
  $graphics.FillRectangle($background, 0, 0, 640, 360)
  $graphics.FillRectangle($card, 82, 22, 476, 316)
  $graphics.DrawString('BAP CALENDAR', $labelFont, $muted, 110, 46)
  $graphics.DrawString('Calendar', $titleFont, $white, 108, 84)
  $weekdays = @('M', 'T', 'W', 'T', 'F', 'S', 'S')
  for ($column = 0; $column -lt 7; $column++) {
    $x = 132 + 57 * $column
    $graphics.DrawString($weekdays[$column], $dayFont, $muted, $x, 146)
  }
  for ($index = 0; $index -lt 35; $index++) {
    $column = $index % 7
    $row = [Math]::Floor($index / 7)
    $x = 127 + 57 * $column
    $y = 177 + 29 * $row
    $number = $index - 1
    if ($number -ge 1 -and $number -le 31) {
      if ($number -eq 15) {
        $graphics.FillEllipse($today, $x - 7, $y - 3, 30, 27)
        $brush = $dark
      } else {
        $brush = $white
      }
      $graphics.DrawString([string]$number, $dayFont, $brush, $x, $y)
    }
  }
  $bitmap.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  foreach ($resource in @($graphics, $bitmap, $background, $card, $white, $muted, $today, $dark, $labelFont, $titleFont, $dayFont)) {
    $resource.Dispose()
  }
}
