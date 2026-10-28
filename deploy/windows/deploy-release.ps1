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
if (Test-Path "$stage\lib-manifest.json") {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $manifest = Get-Content -LiteralPath "$stage\lib-manifest.json" -Raw | ConvertFrom-Json
    $oldJar = [IO.Compression.ZipFile]::OpenRead($jar)
    $slimJar = $null
    $completeJar = $null
    try {
        foreach ($library in $manifest.PSObject.Properties) {
            $entry = $oldJar.GetEntry($library.Name)
            if ($null -eq $entry) { Write-Output 'Full release required: dependency missing.'; exit 42 }
            $stream = $entry.Open()
            $hasher = [Security.Cryptography.SHA256]::Create()
            try { $hash = ([BitConverter]::ToString($hasher.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
            finally { $stream.Dispose(); $hasher.Dispose() }
            if ($hash -ne $library.Value) { Write-Output 'Full release required: dependency changed.'; exit 42 }
        }
        $slimJar = [IO.Compression.ZipFile]::OpenRead("$stage\backend.jar")
        $completeJar = [IO.Compression.ZipFile]::Open("$stage\backend-complete.jar", [IO.Compression.ZipArchiveMode]::Create)
        foreach ($entry in $slimJar.Entries) {
            $destination = $completeJar.CreateEntry($entry.FullName, [IO.Compression.CompressionLevel]::Optimal)
            $input = $entry.Open(); $output = $destination.Open()
            try { $input.CopyTo($output) } finally { $input.Dispose(); $output.Dispose() }
        }
        foreach ($library in $manifest.PSObject.Properties) {
            # Spring Boot requires nested dependency JARs to be STORED, not DEFLATED.
            $destination = $completeJar.CreateEntry($library.Name, [IO.Compression.CompressionLevel]::NoCompression)
            $input = $oldJar.GetEntry($library.Name).Open(); $output = $destination.Open()
            try { $input.CopyTo($output) } finally { $input.Dispose(); $output.Dispose() }
        }
    } finally {
        if ($null -ne $completeJar) { $completeJar.Dispose() }
        if ($null -ne $slimJar) { $slimJar.Dispose() }
        $oldJar.Dispose()
    }
    Move-Item -LiteralPath "$stage\backend-complete.jar" -Destination "$stage\backend.jar" -Force
}
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
