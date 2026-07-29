[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PagesPath = Join-Path $RepoRoot "src\ui\pages.tsx"
$ProductPath = Join-Path $RepoRoot "src\config\product.ts"
$PublicDirectory = Join-Path $RepoRoot "public"
$Pages = Get-Content -Raw -LiteralPath $PagesPath
$Product = Get-Content -Raw -LiteralPath $ProductPath

if ($Pages.Contains('data-template-surface="replace-before-release"')) {
    throw "Replace the starter workspace before release"
}
if ($Pages.Contains('class="hero"') -or $Pages.Contains('class="product-flow"')) {
    throw "Text-led hero and generic product-flow sections are not releaseable"
}
if (-not $Pages.Contains('class="console-demo"') -or -not $Pages.Contains('id="create-form"')) {
    throw "Expected the visual inbox-to-OBS console and creation workspace"
}
if ($Pages -match '(?i)public validation|success criteria|experiment|仮説|成功条件') {
    throw "Research copy must not appear on the product surface"
}
if (-not $Pages.Contains('id="manage-list"') -or -not $Pages.Contains('id="overlay-letter"')) {
    throw "Expected product-specific management and OBS surfaces"
}
if ($Product.Contains('"yose-bloom"') -or $Product.Contains('"Yose Bloom"')) {
    throw "Replace the previous product identity before release"
}

$OgPath = Join-Path $PublicDirectory "og.svg"
if (-not (Test-Path -LiteralPath $OgPath) -or (Get-Item -LiteralPath $OgPath).Length -lt 3000) {
    throw "Expected a product-specific OG SVG larger than 3 KB"
}

$KeyFiles = @(
    Get-ChildItem -LiteralPath $PublicDirectory -File |
        Where-Object { $_.Name -match "^[a-zA-Z0-9-]{8,128}\.txt$" }
)
if ($KeyFiles.Count -ne 1) {
    throw "Expected exactly one generated IndexNow key file, found $($KeyFiles.Count)"
}
$Key = (Get-Content -Raw -LiteralPath $KeyFiles[0].FullName).Trim()
if ($Key -ne $KeyFiles[0].BaseName) {
    throw "IndexNow key file name and content do not match"
}

Write-Output "Product release contract is satisfied"
