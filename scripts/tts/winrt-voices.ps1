# Listează vocile Windows OneCore/WinRT disponibile (nume, limbă, gen) ca JSON UTF-8.
param([Parameter(Mandatory = $true)][string]$Out)
$ErrorActionPreference = 'Stop'
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$voices = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | ForEach-Object { [pscustomobject]@{ name = $_.DisplayName; language = $_.Language; gender = "$($_.Gender)" } }
$json = @($voices) | ConvertTo-Json -Depth 3 -Compress
[System.IO.File]::WriteAllText($Out, $json, (New-Object System.Text.UTF8Encoding($false)))
