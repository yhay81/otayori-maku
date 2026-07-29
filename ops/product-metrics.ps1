[CmdletBinding()]
param(
    [switch]$Local
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$SqlPath = Join-Path $PSScriptRoot "product-metrics.sql"
$Wrangler = Join-Path $RepoRoot "node_modules\.bin\wrangler.cmd"
$Target = if ($Local) { "--local" } else { "--remote" }
$Sql = (Get-Content $SqlPath) -join " "

$Output = & $Wrangler d1 execute otayori-maku $Target --json --command $Sql
if ($LASTEXITCODE -ne 0) {
    throw "D1 metrics query failed with exit code $LASTEXITCODE"
}

$Payload = ($Output -join [Environment]::NewLine) | ConvertFrom-Json
$Row = $Payload[0].results[0]
if (-not $Row) {
    throw "D1 metrics query returned no result"
}

function Get-Percent {
    param([int]$Numerator, [int]$Denominator)
    if ($Denominator -eq 0) { return $null }
    return [Math]::Round(($Numerator / $Denominator) * 100, 1)
}

$Users = [int]$Row.users
$Sessions = [int]$Row.sessions_created
$WithLetters = [int]$Row.sessions_with_letters
$WithSelection = [int]$Row.sessions_with_selection
$WithOverlay = [int]$Row.sessions_with_overlay

[ordered]@{
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    service = "otayori-maku"
    environment = if ($Local) { "local" } else { "production" }
    funnel = [ordered]@{
        users = $Users
        sessions_created = $Sessions
        submit_links_copied = [int]$Row.submit_links_copied
        overlay_links_copied = [int]$Row.overlay_links_copied
        letters_sent = [int]$Row.letters_sent
        sessions_with_letters = $WithLetters
        sessions_with_ten_letters = [int]$Row.sessions_with_ten_letters
        sessions_with_selection = $WithSelection
        sessions_with_overlay = $WithOverlay
        sessions_closed = [int]$Row.sessions_closed
        repeat_hosts = [int]$Row.repeat_hosts
        returned = [int]$Row.returned
        users_7d = [int]$Row.users_7d
        sessions_7d = [int]$Row.sessions_7d
    }
    rates = [ordered]@{
        creation_percent = Get-Percent $Sessions $Users
        first_letter_percent = Get-Percent $WithLetters $Sessions
        selection_percent = Get-Percent $WithSelection $WithLetters
        overlay_percent = Get-Percent $WithOverlay $Sessions
    }
} | ConvertTo-Json -Depth 4
