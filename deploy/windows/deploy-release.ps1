param([Parameter(Mandatory = $true)][string]$ReleaseArchive)
$ErrorActionPreference = 'Stop'
$root = 'C:\apps\feynman'
$incoming = [IO.Path]::GetFullPath((Join-Path $root 'incoming')) + '\'
$archive = [IO.Path]::GetFullPath($ReleaseArchive)
if (-not $archive.StartsWith($incoming, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $archive)) {
    throw 'Release archive must exist under C:\apps\feynman\incoming.'
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stage = Join-Path $incoming ([Guid]::NewGuid().ToString('N'))
$backup = Join-Path $root "backups\$stamp"
$jar = Join-Path $root 'feynman-platform-springboot-0.0.1-SNAPSHOT.jar'
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Path $stage, $backup -Force | Out-Null
Expand-Archive -LiteralPath $archive -DestinationPath $stage
if (-not (Test-Path "$stage\dist\index.html") -or -not (Test-Path "$stage\backend.jar")) {
    throw 'Release is incomplete; the running application was not changed.'
}
if (-not (Test-Path $jar) -or -not (Test-Path $dist)) { throw 'Existing deployment missing; complete the initial deployment first.' }
Copy-Item -LiteralPath $jar -Destination "$backup\backend.jar"
Copy-Item -LiteralPath $dist -Destination "$backup\dist" -Recurse

function Stop-FeynmanBackend {
    Stop-ScheduledTask -TaskName 'Feynman Backend'
    Start-Sleep -Seconds 3
    # Task Scheduler can leave the child Java process running. Only stop this application's JAR.
    $javaProcesses = Get-CimInstance Win32_Process | Where-Object {
        $_.Name -eq 'java.exe' -and $_.CommandLine -like '*feynman-platform-springboot-0.0.1-SNAPSHOT.jar*'
    }
    foreach ($process in $javaProcesses) { Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop }
    Start-Sleep -Seconds 2
    if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) {
        throw 'Port 8080 is occupied by another process. Deployment stopped.'
    }
}

function Wait-FeynmanBackend {
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Seconds 4
        try {
            $health = Invoke-RestMethod 'http://127.0.0.1:8080/api/health' -TimeoutSec 4
            if ($health.status -eq 'OK') { return }
        } catch { }
    }
    throw 'Backend health check failed after startup.'
}

Stop-FeynmanBackend
try {
    Copy-Item -LiteralPath "$stage\backend.jar" -Destination $jar -Force
    Start-ScheduledTask -TaskName 'Feynman Backend'
    Wait-FeynmanBackend
    # Switch the frontend only after the backend is ready. Preserve start scripts, models and secrets.
    $resolvedDist = [IO.Path]::GetFullPath($dist)
    if ($resolvedDist -ne 'C:\apps\feynman\dist') { throw 'Unexpected frontend target.' }
    Remove-Item -LiteralPath $resolvedDist -Recurse -Force
    Copy-Item -LiteralPath "$stage\dist" -Destination $dist -Recurse
    Copy-Item -LiteralPath "$stage\revision.txt" -Destination "$root\revision.txt" -Force
    Write-Output "Deployment succeeded. Backup: $backup"
} catch {
    $failure = $_
    Write-Warning 'Deployment failed. Restoring application files. Database migrations are not rolled back.'
    Stop-FeynmanBackend
    Copy-Item -LiteralPath "$backup\backend.jar" -Destination $jar -Force
    if (Test-Path $dist) { Remove-Item -LiteralPath $dist -Recurse -Force }
    Copy-Item -LiteralPath "$backup\dist" -Destination $dist -Recurse
    Start-ScheduledTask -TaskName 'Feynman Backend'
    throw $failure
}
