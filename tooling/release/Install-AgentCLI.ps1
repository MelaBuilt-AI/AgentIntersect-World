<#
.SYNOPSIS
  Installs the Codex CLI or Claude Code CLI for AgentIntersect World on native Windows.

.DESCRIPTION
  For people who code through the ChatGPT or Claude desktop apps and have no CLI yet.
  If the Codex app or Claude app is installed, World already uses the CLI bundled inside it
  and this script is not needed. Uses each vendor's official installer; afterwards sign in
  once with the same account you use in the desktop app, then click Discover Agents in World.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\Install-AgentCLI.ps1 -Agent Codex
#>
param(
  [ValidateSet('Codex', 'Claude')]
  [string]$Agent
)
$ErrorActionPreference = 'Stop'

if (-not $Agent) {
  Write-Host 'Which agent do you use?'
  Write-Host '  1) ChatGPT / Codex  (installs the Codex CLI)'
  Write-Host '  2) Claude           (installs Claude Code)'
  $Agent = if ((Read-Host 'Choose 1 or 2') -eq '2') { 'Claude' } else { 'Codex' }
}

if ($Agent -eq 'Claude') {
  Write-Host 'Installing Claude Code with the official installer (claude.ai/install.ps1)...'
  Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression
  $command = 'claude'
} else {
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
      throw 'Node.js is required for the Codex CLI. Install Node.js LTS from https://nodejs.org, then run this script again.'
    }
    Write-Host 'Installing Node.js LTS with winget...'
    winget install --id OpenJS.NodeJS.LTS --exact --accept-source-agreements --accept-package-agreements
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  }
  Write-Host 'Installing the Codex CLI (npm package @openai/codex)...'
  npm install --global @openai/codex
  $command = 'codex'
}

$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
  throw "$command was installed but is not on PATH yet. Open a new PowerShell window and run '$command --version'."
}
& $command --version
Write-Host ''
Write-Host "Next: run '$command' once and sign in with the same account you use in the desktop app."
Write-Host 'Then return to AgentIntersect World and click Discover Agents.'
