[CmdletBinding()]
param(
  [switch]$SkipNpmInstall,
  [switch]$SkipModelBuild,
  [switch]$BuildPortable,
  [switch]$CreateShortcut,
  [switch]$PreferSourceShortcut,
  [string]$ShortcutPath
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$ollamaSetupScript = Join-Path $PSScriptRoot 'setup-ollama-models.ps1'
$shortcutScript = Join-Path $PSScriptRoot 'create-desktop-shortcut.ps1'

function Assert-Command {
  param(
    [string]$Name,
    [string]$InstallHint
  )

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is not installed or not on PATH. $InstallHint"
  }
}

Push-Location $repoRoot
try {
  Assert-Command -Name 'npm' -InstallHint 'Install Node.js before running this setup.'

  if (-not $SkipNpmInstall) {
    Write-Host 'Installing app dependencies with npm install'
    npm install
    if ($LASTEXITCODE -ne 0) {
      throw 'npm install failed.'
    }
  }

  if (-not $SkipModelBuild) {
    Assert-Command -Name 'ollama' -InstallHint 'Install Ollama and make sure it is running before building models.'
    Write-Host 'Building PF2e Ollama models'
    & powershell -ExecutionPolicy Bypass -File $ollamaSetupScript
    if ($LASTEXITCODE -ne 0) {
      throw 'PF2e model setup failed.'
    }
  }

  if ($BuildPortable) {
    Write-Host 'Building portable executable'
    npm run dist
    if ($LASTEXITCODE -ne 0) {
      throw 'Portable build failed.'
    }
  }

  if ($CreateShortcut) {
    Write-Host 'Creating desktop shortcut'
    $shortcutArgs = @{
      ShortcutPath = $ShortcutPath
    }

    if ($PreferSourceShortcut) {
      $shortcutArgs.PreferSourceLauncher = $true
    }

    & powershell -ExecutionPolicy Bypass -File $shortcutScript @shortcutArgs
    if ($LASTEXITCODE -ne 0) {
      throw 'Desktop shortcut creation failed.'
    }
  }

  Write-Host ''
  Write-Host 'Other PC setup completed.'
  Write-Host 'Next steps: import your campaign JSON, set your PDF folder, then click Test AI in the app.'
}
finally {
  Pop-Location
}
