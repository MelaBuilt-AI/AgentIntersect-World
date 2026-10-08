#ifndef PackageRoot
  #error PackageRoot is required
#endif
#ifndef OutputPath
  #error OutputPath is required
#endif
#ifndef ReleaseVersion
  #define ReleaseVersion "0.15.0-rc.2-windows.3"
#endif
[Setup]
AppId=AgentIntersectWorld
AppName=AgentIntersect World
AppVersion={#ReleaseVersion}
AppPublisher=MelaBuilt-AI
AppPublisherURL=https://agentintersect.com/
AppSupportURL=https://guide.agentintersect.com/
AppUpdatesURL=https://agentintersect.com/download/
DefaultDirName={localappdata}\Programs\AgentIntersect-World
DefaultGroupName=AgentIntersect World
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
UninstallDisplayName=AgentIntersect World
LicenseFile={#PackageRoot}\LICENSE
InfoBeforeFile=installer-notice.txt
OutputDir={#OutputPath}
OutputBaseFilename=AgentIntersect-World-{#ReleaseVersion}-windows-x64-setup
VersionInfoVersion=0.15.0.5
VersionInfoProductName=AgentIntersect World
VersionInfoProductVersion=0.15.0.5
VersionInfoProductTextVersion={#ReleaseVersion}
Compression=lzma2/normal
SolidCompression=yes
LZMANumBlockThreads=2
WizardStyle=modern
SetupIconFile=..\..\assets\brand\agentintersect.ico
UninstallDisplayIcon={app}\agentintersect-appicon.ico
SetupLogging=yes
CloseApplications=yes
RestartApplications=no
[Files]
Source: "{#PackageRoot}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\AgentIntersect World"; Filename: "{app}\AgentIntersect-World.cmd"; WorkingDir: "{app}"; IconFilename: "{app}\agentintersect-appicon.ico"
Name: "{group}\Install Codex or Claude Code CLI"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\Install-AgentCLI.ps1"""; WorkingDir: "{app}"
Name: "{autodesktop}\AgentIntersect World"; Filename: "{app}\AgentIntersect-World.cmd"; WorkingDir: "{app}"; IconFilename: "{app}\agentintersect-appicon.ico"
Name: "{group}\Uninstall AgentIntersect World"; Filename: "{uninstallexe}"
[Run]
Filename: "{app}\AgentIntersect-World.cmd"; Description: "Open AgentIntersect World"; Flags: postinstall shellexec skipifsilent nowait
