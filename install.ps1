# Motion Marketing Studio - instalare pe Windows
# Rulează din folderul repo-ului, în PowerShell:
#   powershell -ExecutionPolicy Bypass -File install.ps1
# Opțiuni:
#   -Yes            instalează fără întrebări ce lipsește (Node.js, Git) prin winget
#   -SkipBrowsers   nu descărca browserele (doar dacă le ai deja)
param(
  [switch]$Yes,
  [switch]$SkipBrowsers
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Write-Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Write-Ok($text) { Write-Host "  [ok] $text" -ForegroundColor Green }
function Write-Warn2($text) { Write-Host "  [!] $text" -ForegroundColor Yellow }
function Fail($text) { Write-Host "  [x] $text" -ForegroundColor Red; exit 1 }

function Refresh-Path {
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
}

function Ask($question) {
  if ($Yes) { return $true }
  $answer = Read-Host "$question [d/N]"
  return $answer -match '^(d|da|y|yes)$'
}

function Install-WithWinget($id, $name) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Fail "$name lipsește și winget nu e disponibil. Instalează $name manual, apoi rulează din nou acest script."
  }
  if (-not (Ask "$name lipsește. Îl instalez acum cu winget ($id)?")) {
    Fail "$name este necesar. Instalează-l și rulează din nou scriptul."
  }
  winget install --id $id -e --accept-source-agreements --accept-package-agreements
  Refresh-Path
}

Write-Host "Motion Marketing Studio - instalare" -ForegroundColor White
Write-Host "Folder: $PSScriptRoot"
if ($PSScriptRoot -match 'OneDrive') {
  Write-Warn2 "Repo-ul e în OneDrive. Recomandat: mută-l în C:\dev\ (OneDrive blochează fișierele mari și încetinește randarea)."
}

# 1. Node.js >= 20.11
Write-Step "Node.js"
$node = Get-Command node -ErrorAction SilentlyContinue
$needNode = $true
if ($node) {
  $v = (node --version).TrimStart('v').Split('.')
  if ([int]$v[0] -gt 20 -or ([int]$v[0] -eq 20 -and [int]$v[1] -ge 11)) { $needNode = $false; Write-Ok "Node.js v$($v -join '.')" }
  else { Write-Warn2 "Node.js v$($v -join '.') e prea vechi (minim 20.11)." }
}
if ($needNode) {
  Install-WithWinget 'OpenJS.NodeJS.LTS' 'Node.js LTS'
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Node.js nu e încă în PATH. Închide și redeschide PowerShell, apoi rulează din nou scriptul." }
  Write-Ok "Node.js $(node --version)"
}

# 2. Git (pentru npm run update)
Write-Step "Git"
if (Get-Command git -ErrorAction SilentlyContinue) { Write-Ok (git --version) }
else {
  Install-WithWinget 'Git.Git' 'Git'
  if (Get-Command git -ErrorAction SilentlyContinue) { Write-Ok (git --version) } else { Write-Warn2 "Git nu e în PATH încă; e necesar doar pentru actualizări." }
}

# 3. Dependențele npm (exact versiunile din package-lock.json)
Write-Step "Dependențe npm (npm ci)"
npm ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Fail "npm ci a eșuat. Verifică mesajul de mai sus (conexiune la internet, spațiu pe disc)." }
Write-Ok "dependențe instalate"

# 4. Browserele: randare (Remotion) și captură (Playwright)
if (-not $SkipBrowsers) {
  Write-Step "Browser de randare (Remotion)"
  npx remotion browser ensure
  if ($LASTEXITCODE -ne 0) { Fail "Nu am putut descărca browserul de randare." }
  Write-Step "Browser de captură (Playwright Chromium)"
  npx playwright install chromium
  if ($LASTEXITCODE -ne 0) { Fail "Nu am putut descărca browserul de captură." }
}

# 5. Configurare locală
Write-Step "Configurare"
if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
  Write-Ok ".env creat din .env.example (cheile sunt opționale)"
} else { Write-Ok ".env există deja (nu îl modific)" }
npx tsx scripts/setup.ts
if ($LASTEXITCODE -ne 0) { Fail "Pregătirea folderelor a eșuat." }

# 6. Verificare finală
Write-Step "Verificare (npm run doctor)"
npx tsx scripts/doctor.ts
if ($LASTEXITCODE -ne 0) { Fail "Doctor a găsit probleme. Rezolvă-le după indicațiile de mai sus și rulează din nou." }

Write-Host "`nGata. Pornește Studio-ul cu:" -ForegroundColor Green
Write-Host "  npm run studio" -ForegroundColor White
Write-Host "Test complet pe produsul demo (opțional, ~3 minute):  npm run e2e -- --fresh"
