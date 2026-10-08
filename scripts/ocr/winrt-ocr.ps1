# OCR offline cu motorul Windows (Windows.Media.Ocr, WinRT), fără instalări: textul dintr-o imagine,
# pe linii și cuvinte, cu cutiile lor în pixelii imaginii. Rezultatul: JSON UTF-8.
param(
  [Parameter(Mandatory = $true)][string]$Image,
  [Parameter(Mandatory = $true)][string]$Out,
  [string]$Language = ""
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$t) { $m = $asTask.MakeGenericMethod($t); $task = $m.Invoke($null, @($op)); $task.Wait(); $task.Result }

$engine = $null
if ($Language) {
  $lang = New-Object Windows.Globalization.Language($Language)
  if ([Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($lang)) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang) }
}
if (-not $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
if (-not $engine) { throw "Motorul OCR Windows nu e disponibil (lipsește pachetul de limbă cu OCR)." }

$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path $Image).Path)) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
# motorul are o limită de dimensiune: imaginile mai mari se scalează (cutiile se readuc la scara originală)
$max = [Windows.Media.Ocr.OcrEngine]::MaxImageDimension
$scale = 1.0
if ($bitmap.PixelWidth -gt $max -or $bitmap.PixelHeight -gt $max) {
  $scale = [Math]::Min($max / $bitmap.PixelWidth, $max / $bitmap.PixelHeight)
  $t = New-Object Windows.Graphics.Imaging.BitmapTransform
  $t.ScaledWidth = [uint32][Math]::Floor($bitmap.PixelWidth * $scale)
  $t.ScaledHeight = [uint32][Math]::Floor($bitmap.PixelHeight * $scale)
  $bitmap = Await ($decoder.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied, $t, [Windows.Graphics.Imaging.ExifOrientationMode]::IgnoreExifOrientation, [Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage)) ([Windows.Graphics.Imaging.SoftwareBitmap])
}
$result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
$lines = @()
foreach ($l in $result.Lines) {
  $words = @()
  foreach ($w in $l.Words) {
    $r = $w.BoundingRect
    $words += [pscustomobject]@{ text = $w.Text; x = [Math]::Round($r.X / $scale); y = [Math]::Round($r.Y / $scale); w = [Math]::Round($r.Width / $scale); h = [Math]::Round($r.Height / $scale) }
  }
  $lines += [pscustomobject]@{ text = $l.Text; words = $words }
}
$json = [pscustomobject]@{ language = $engine.RecognizerLanguage.LanguageTag; lines = $lines } | ConvertTo-Json -Depth 6 -Compress
[System.IO.File]::WriteAllText($Out, $json, (New-Object System.Text.UTF8Encoding($false)))
