# Sinteză vocală offline cu vocile Windows (OneCore/WinRT), inclusiv cele românești (ex. Microsoft Andrei).
# Textul vine dintr-un fișier UTF-8 (ca diacriticele să nu se piardă), rezultatul: WAV + JSON cu cuvintele.
param(
  [Parameter(Mandatory = $true)][string]$TextFile,
  [Parameter(Mandatory = $true)][string]$Voice,
  [Parameter(Mandatory = $true)][string]$Out,
  [Parameter(Mandatory = $true)][string]$MetaOut,
  [double]$Rate = 1.0,
  [switch]$List
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$t) { $m = $asTask.MakeGenericMethod($t); $task = $m.Invoke($null, @($op)); $task.Wait(); $task.Result }

$s = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$v = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -eq $Voice -or $_.DisplayName -like "*$Voice*" } | Select-Object -First 1
if (-not $v) { throw "Vocea '$Voice' nu este instalata." }
$s.Voice = $v
$s.Options.IncludeWordBoundaryMetadata = $true
$s.Options.SpeakingRate = $Rate
$text = [System.IO.File]::ReadAllText($TextFile, [System.Text.Encoding]::UTF8)
$stream = Await ($s.SynthesizeTextToStreamAsync($text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
$words = @()
foreach ($track in $stream.TimedMetadataTracks) {
  foreach ($cue in $track.Cues) { $words += [pscustomobject]@{ text = $cue.Text; start = $cue.StartTime.TotalSeconds } }
}
$size = [uint32]$stream.Size
$reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
$null = Await ($reader.LoadAsync($size)) ([uint32])
$bytes = New-Object byte[] $size
$reader.ReadBytes($bytes)
[System.IO.File]::WriteAllBytes($Out, $bytes)
$json = [pscustomobject]@{ voice = $v.DisplayName; language = $v.Language; words = $words } | ConvertTo-Json -Depth 4 -Compress
[System.IO.File]::WriteAllText($MetaOut, $json, (New-Object System.Text.UTF8Encoding($false)))
