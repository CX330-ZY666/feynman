@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0.mvn\wrapper\run-maven.ps1" %*
exit /b %ERRORLEVEL%

# PowerShell portion
$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$propertiesPath = Join-Path $projectDir '.mvn\wrapper\maven-wrapper.properties'
$properties = @{}
Get-Content -LiteralPath $propertiesPath | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $properties[$matches[1].Trim()] = $matches[2].Trim()
    }
}

$distributionUrl = $properties['distributionUrl']
$archiveName = Split-Path -Leaf $distributionUrl
$mavenVersion = [regex]::Match($archiveName, 'apache-maven-([0-9.]+)-bin\.zip').Groups[1].Value
$wrapperHome = Join-Path $env:USERPROFILE '.m2\wrapper\dists'
$installDir = Join-Path $wrapperHome "apache-maven-$mavenVersion"
$mavenCmd = Join-Path $installDir "apache-maven-$mavenVersion\bin\mvn.cmd"

if (-not (Test-Path -LiteralPath $mavenCmd)) {
    New-Item -ItemType Directory -Force -Path $installDir | Out-Null
    $archivePath = Join-Path $installDir $archiveName
    Write-Host "Downloading Maven $mavenVersion..."
    Invoke-WebRequest -Uri $distributionUrl -OutFile $archivePath
    Expand-Archive -LiteralPath $archivePath -DestinationPath $installDir -Force
    Remove-Item -LiteralPath $archivePath -Force
}

$separator = [Array]::IndexOf($args, '--')
$mavenArgs = if ($separator -ge 0) { $args[($separator + 1)..($args.Length - 1)] } else { $args }
Push-Location $projectDir
try {
    & $mavenCmd @mavenArgs
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
