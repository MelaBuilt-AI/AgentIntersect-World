#ifndef PackageRoot
  #error PackageRoot is required
#endif
#ifndef OutputPath
  #error OutputPath is required
#endif
#ifndef ReleaseVersion
  #define ReleaseVersion "0.15.0-rc.1"
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
VersionInfoVersion=0.15.0.1
VersionInfoProductName=AgentIntersect World
VersionInfoProductVersion=0.15.0.1
VersionInfoProductTextVersion={#ReleaseVersion}
Compression=lzma2/normal
SolidCompression=yes
LZMANumBlockThreads=2
WizardStyle=modern
SetupLogging=yes
CloseApplications=yes
RestartApplications=no
[Files]
Source: "{#PackageRoot}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\AgentIntersect World"; Filename: "{app}\AgentIntersect-World.cmd"; WorkingDir: "{app}"
Name: "{group}\Uninstall AgentIntersect World"; Filename: "{uninstallexe}"
[Run]
Filename: "{app}\AgentIntersect-World.cmd"; Description: "Open AgentIntersect World"; Flags: postinstall shellexec skipifsilent nowait
