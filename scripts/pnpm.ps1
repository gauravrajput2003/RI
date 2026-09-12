# Use the repository's pinned manager, not a conflicting global pnpm/npm shim.
$ErrorActionPreference = 'Stop'
$repositoryPath = Split-Path -Parent $PSScriptRoot
$package = Get-Content -Raw -LiteralPath (Join-Path $repositoryPath 'package.json') | ConvertFrom-Json
if ($package.packageManager -notmatch '^pnpm@\d+\.\d+\.\d+$') { throw 'Expected an exact pnpm version in package.json.' }
$nodePath = (Get-Command node -ErrorAction Stop).Source
$npmCliPath = Join-Path (Split-Path -Parent $nodePath) 'node_modules/npm/bin/npm-cli.js'
if (-not (Test-Path -LiteralPath $npmCliPath)) { throw 'The Node installation is missing npm/bin/npm-cli.js. Repair Node/npm before installing.' }
Push-Location -LiteralPath $repositoryPath
try {
  & $nodePath $npmCliPath exec --yes "--package=$($package.packageManager)" -- pnpm @args
  $commandExitCode = $LASTEXITCODE
} finally { Pop-Location }
exit $commandExitCode
