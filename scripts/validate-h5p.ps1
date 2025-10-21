Param(
  [string]$ContentRoot = "conteudos"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Info($Message) {
  Write-Host "[info] $Message" -ForegroundColor Cyan
}

function Write-Warn($Message) {
  Write-Warning "[warn] $Message"
}

function Write-Ok($Message) {
  Write-Host "[ ok ] $Message" -ForegroundColor Green
}

try {
  $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
  $repoRoot = Resolve-Path (Join-Path $scriptRoot "..")
  $contentRootPath = Resolve-Path (Join-Path $repoRoot $ContentRoot) -ErrorAction Stop
} catch {
  Write-Error "Nao foi possivel localizar a pasta '$ContentRoot'. Execute o script dentro do repositorio."
  exit 1
}

$contentDirs = Get-ChildItem -Path $contentRootPath -Directory -ErrorAction Stop
if (-not $contentDirs) {
  Write-Warn "Nenhum conteudo H5P encontrado em '$ContentRoot'."
  exit 0
}

foreach ($contentDir in $contentDirs) {
  Write-Info "Analisando '$($contentDir.Name)'..."

  $manifestPath = Join-Path $contentDir.FullName "h5p.json"
  if (-not (Test-Path $manifestPath)) {
    Write-Warn "Arquivo 'h5p.json' nao encontrado."
    Write-Host ""
    continue
  }

  try {
    $manifestJson = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
  } catch {
    Write-Warn "Falha ao ler 'h5p.json': $($_.Exception.Message)"
    Write-Host ""
    continue
  }

  $contentPath = Join-Path $contentDir.FullName "content"
  $contentFilePath = Join-Path $contentPath "content.json"
  if (-not (Test-Path $contentPath)) {
    Write-Warn "Pasta 'content/' nao encontrada."
  } elseif (-not (Test-Path $contentFilePath)) {
    Write-Warn "'content/content.json' ausente."
  } else {
    Write-Ok "'content/content.json' encontrado."
  }

  $librariesPath = Join-Path $contentDir.FullName "libraries"
  if (-not (Test-Path $librariesPath)) {
    Write-Warn "Pasta 'libraries/' nao encontrada - o H5P falhara com 404."
    Write-Host ""
    continue
  }

  $missingLibraries = @()
  foreach ($dependency in $manifestJson.preloadedDependencies) {
    if (-not $dependency.machineName) {
      continue
    }

    $libraryFolder = "{0}-{1}.{2}" -f $dependency.machineName, $dependency.majorVersion, $dependency.minorVersion
    $libraryFullPath = Join-Path $librariesPath $libraryFolder

    if (-not (Test-Path $libraryFullPath)) {
      $missingLibraries += $libraryFolder
    }
  }

  if ($missingLibraries.Count -eq 0) {
    Write-Ok "Todas as bibliotecas listadas em 'h5p.json' estao presentes."
  } else {
    Write-Warn "Bibliotecas ausentes: $($missingLibraries -join ', ')"
  }

  Write-Host ""
}
