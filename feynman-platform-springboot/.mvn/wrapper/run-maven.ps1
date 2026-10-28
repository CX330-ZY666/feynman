$ErrorActionPreference = 'Stop'
$projectDir = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$distributionUrl = 'https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.16/apache-maven-3.9.16-bin.zip'
$installDir = Join-Path $env:USERPROFILE '.m2\wrapper\dists\apache-maven-3.9.16'
$mavenCmd = Join-Path $installDir 'apache-maven-3.9.16\bin\mvn.cmd'

if (-not (Test-Path -LiteralPath $mavenCmd)) {
    New-Item -ItemType Directory -Force -Path $installDir | Out-Null
    $archivePath = Join-Path $installDir 'apache-maven-3.9.16-bin.zip'
    Write-Host '首次运行：正在下载 Maven 3.9.16...'
    Invoke-WebRequest -Uri $distributionUrl -OutFile $archivePath
    Expand-Archive -LiteralPath $archivePath -DestinationPath $installDir -Force
    Remove-Item -LiteralPath $archivePath -Force
}

Push-Location $projectDir
try {
    & $mavenCmd @args
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
