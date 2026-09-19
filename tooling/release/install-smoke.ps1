param([Parameter(Mandatory=$true)][string]$Installer,[Parameter(Mandatory=$true)][string]$SmokeTest,[Parameter(Mandatory=$true)][string]$Receipt)
$ErrorActionPreference='Stop'
$key='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\AgentIntersectWorld_is1'
if(Test-Path $key){throw 'An existing World installation is registered; refusing to replace it during smoke.'}
$root=Join-Path ([IO.Path]::GetTempPath()) ('aiw-installer-smoke-'+[guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $root | Out-Null
$install=Join-Path $root 'Application With Spaces'
$result=@{installer=(Get-Item $Installer).Name;sha256=(Get-FileHash $Installer -Algorithm SHA256).Hash;signature=(Get-AuthenticodeSignature $Installer).Status.ToString();installed=$false;nativeSmoke=$false;uninstalled=$false}
try {
 $p=Start-Process -FilePath $Installer -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/CURRENTUSER','/NOICONS',('/DIR="'+$install+'"'),('/LOG="'+$root+'\install.log"')) -Wait -PassThru
 if($p.ExitCode -ne 0){throw ('Installer failed: '+$p.ExitCode)}
 if(!(Test-Path "$install\runtime\node.exe") -or !(Test-Path $key)){throw 'Installed files or uninstall registration missing'}
 $result.installed=$true
 Push-Location $install
 try { & "$install\runtime\node.exe" --test $SmokeTest; if($LASTEXITCODE -ne 0){throw 'Native installed-package smoke failed'}; $result.nativeSmoke=$true } finally {Pop-Location}
} finally {
 if(Test-Path "$install\unins000.exe") {
  $u=Start-Process -FilePath "$install\unins000.exe" -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART') -Wait -PassThru
  $result.uninstalled=($u.ExitCode -eq 0 -and !(Test-Path "$install\runtime\node.exe") -and !(Test-Path $key))
 }
 $result | ConvertTo-Json | Set-Content -Path $Receipt -Encoding UTF8
 $result | ConvertTo-Json
}
if(!$result.uninstalled){throw 'Uninstall cleanup did not verify'}
