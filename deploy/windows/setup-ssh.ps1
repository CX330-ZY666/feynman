param([Parameter(Mandatory = $true)][string]$PublicKeyFile)
$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run PowerShell as Administrator.' }
$publicKey = (Get-Content -LiteralPath $PublicKeyFile -Raw).Trim()
if ($publicKey -notmatch '^ssh-ed25519 [A-Za-z0-9+/=]+(?: .*)?$') { throw 'Expected an Ed25519 PUBLIC key, not a private key.' }
$capability = Get-WindowsCapability -Online -Name 'OpenSSH.Server*'
if ($capability.State -ne 'Installed') { Add-WindowsCapability -Online -Name $capability.Name | Out-Null }
Start-Service sshd
Set-Service sshd -StartupType Automatic
$keyFile = Join-Path $env:ProgramData 'ssh\administrators_authorized_keys'
$existing = if (Test-Path $keyFile) { @(Get-Content -LiteralPath $keyFile) } else { @() }
if ($existing -notcontains $publicKey) {
    [IO.File]::WriteAllLines($keyFile, @($existing) + @($publicKey), [Text.Encoding]::ASCII)
}
& icacls.exe $keyFile /inheritance:r /grant '*S-1-5-32-544:F' /grant '*S-1-5-18:F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not secure authorized_keys permissions.' }
# The standard Windows OpenSSH configuration uses this file for Administrator accounts.
if (-not (Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -DisplayName 'OpenSSH Server' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 | Out-Null
}
New-Item -ItemType Directory -Path 'C:\apps\feynman\incoming' -Force | Out-Null
Write-Output 'SSH is ready. Allow TCP 22 in the Tencent Cloud firewall. Keep the private key in GitHub Actions Secrets only.'
Write-Output 'Server host key fingerprint (compare with the SSH prompt on your own PC):'
& ssh-keygen.exe -lf "$env:ProgramData\ssh\ssh_host_ed25519_key.pub"
