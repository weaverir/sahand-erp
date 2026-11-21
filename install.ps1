$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
if (!(Test-Path -LiteralPath (Join-Path $root 'prisma/schema.prisma')) -or !(Test-Path -LiteralPath (Join-Path $root 'app'))) {
  throw 'Run this script from the Sahand ERP project root.'
}
$scriptFolder = Split-Path -Parent $MyInvocation.MyCommand.Path
$candidates = @($scriptFolder, (Join-Path $scriptFolder 'sahand-correspondence'), (Join-Path $root 'sahand-correspondence'), (Join-Path (Split-Path -Parent $root) 'sahand-correspondence'))
$bundle = $null
foreach ($candidate in $candidates) {
  if (Test-Path -LiteralPath (Join-Path $candidate 'schema.prisma')) {
    $bundle = $candidate
    break
  }
}
if ($null -eq $bundle) {
  throw 'Bundle not found. Extract sahand-correspondence-stage2.zip next to the sahand folder, then run this installer from the sahand project root.'
}
$schemaPath = Join-Path $root 'prisma/schema.prisma'
$schema = Get-Content -Raw -Encoding UTF8 -LiteralPath $schemaPath
$extra = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $bundle 'schema.prisma')
$marker = '// Correspondence is retained even when an employee leaves the company.'
if ($schema.Contains('model CorrespondenceLetter {')) {
  Write-Host 'Correspondence models already exist. Schema left unchanged.'
} else {
  $index = $extra.IndexOf($marker, [System.StringComparison]::Ordinal)
  if ($index -lt 0) { throw 'Correspondence model marker not found. No changes made.' }
  $append = $extra.Substring($index)
  Copy-Item -LiteralPath $schemaPath -Destination "$schemaPath.correspondence-backup" -Force
  [System.IO.File]::AppendAllText($schemaPath, "`r`n" + $append, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host 'Correspondence models appended. Schema backup created.'
}
$paths = @(
 'modules/correspondence/policy.ts',
 'modules/correspondence/service.ts',
 'app/api/correspondence/route.ts',
 'app/api/correspondence/assignments/route.ts',
 'app/api/correspondence/[id]/decision/route.ts',
 'app/(erp)/correspondence/page.tsx'
)
foreach ($relative in $paths) {
  $source = Join-Path $bundle $relative
  if (!(Test-Path -LiteralPath $source)) { throw "Missing bundle file: $relative" }
}
foreach ($relative in $paths) {
  $source = Join-Path $bundle $relative
  $dest = Join-Path $root $relative
  $dir = Split-Path -Parent $dest
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  if (Test-Path -LiteralPath $dest) {
    Copy-Item -LiteralPath $dest -Destination "$dest.correspondence-backup" -Force
  }
  Copy-Item -LiteralPath $source -Destination $dest -Force
}
Write-Host 'Correspondence files installed. Next: prisma validate, migrate dev, generate, and tsc.'
