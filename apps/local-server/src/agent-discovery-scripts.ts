/** Fixed metadata-only scripts. They do not execute harnesses, source profiles, or write files. */
export const WINDOWS_DISCOVERY_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$homePath = [Environment]::GetFolderPath('UserProfile')
$results = @()
$commands = @{ 'hermes'='hermes'; 'openclaw'='openclaw'; 'codex'='codex'; 'claude-code'='claude' }
foreach ($harness in @('hermes','openclaw','codex','claude-code')) {
  $name = $commands[$harness]
  $paths = @(Get-Command $name -CommandType Application -All -ErrorAction SilentlyContinue | ForEach-Object { $_.Source })
  foreach ($directory in @((Join-Path $homePath '.local\bin'), (Join-Path $homePath '.bun\bin'), (Join-Path $homePath 'AppData\Roaming\npm'))) {
    foreach ($extension in @('.exe','.cmd','.bat')) {
      $candidate = Join-Path $directory ($name + $extension)
      if (Test-Path -LiteralPath $candidate -PathType Leaf) { $paths += $candidate }
    }
  }
  $folder = if ($harness -eq 'claude-code') { '.claude' } else { '.' + $harness }
  $profilePath = Join-Path $homePath $folder
  $identities = @(@{ id='default'; label='Default'; kind='profile'; profilePath=$profilePath })
  if ($harness -eq 'hermes') {
    $profiles = Join-Path $profilePath 'profiles'
    if (Test-Path -LiteralPath $profiles -PathType Container) {
      $identities += @(Get-ChildItem -LiteralPath $profiles -Directory | Where-Object { $_.Name -match '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' } | Select-Object -First 64 | ForEach-Object { @{ id=$_.Name; label=$_.Name; kind='profile'; profilePath=$_.FullName } })
    }
  }
  if ($harness -eq 'claude-code') {
    $agents = Join-Path $profilePath 'agents'
    if (Test-Path -LiteralPath $agents -PathType Container) {
      $identities += @(Get-ChildItem -LiteralPath $agents -File -Filter '*.md' | Where-Object { $_.BaseName -match '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' } | Select-Object -First 64 | ForEach-Object { @{ id=$_.BaseName; label=$_.BaseName; kind='agent'; profilePath=$profilePath } })
    }
  }
  if ($harness -eq 'codex') {
    $config = Join-Path $profilePath 'config.toml'
    if ((Test-Path -LiteralPath $config -PathType Leaf) -and (Get-Item -LiteralPath $config).Length -le 262144) {
      $text = [IO.File]::ReadAllText($config)
      foreach ($match in [regex]::Matches($text, '(?m)^\s*\[profiles\.(?:"([A-Za-z0-9._-]+)"|([A-Za-z0-9._-]+))\]\s*(?:#.*)?$') | Select-Object -First 64) {
        $id = if ($match.Groups[1].Success) { $match.Groups[1].Value } else { $match.Groups[2].Value }
        if ($id -ne 'default') { $identities += @{ id=$id; label=$id; kind='profile'; profilePath=$profilePath } }
      }
    }
  }
  if ($harness -eq 'openclaw') {
    $identities = @(@{ id='main'; label='Main'; kind='agent'; profilePath=$profilePath })
    $config = Join-Path $profilePath 'openclaw.json'
    if ((Test-Path -LiteralPath $config -PathType Leaf) -and (Get-Item -LiteralPath $config).Length -le 262144) {
      try {
        $native = [IO.File]::ReadAllText($config) | ConvertFrom-Json
        $agents = @($native.agents.list | Where-Object { $_.id -match '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' } | Select-Object -First 64 | ForEach-Object { @{ id=$_.id; label=$_.id; kind='agent'; profilePath=$profilePath } })
        if ($agents.Count) { $identities = $agents }
      } catch { }
    }
  }
  foreach ($executable in @($paths | Sort-Object -Unique | Select-Object -First 32)) {
    $results += @{ adapterId=$harness; executablePath=$executable; identities=$identities }
  }
}
$defaultDistro = $null
try {
  $lxss = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss'
  $defaultId = (Get-ItemProperty -LiteralPath $lxss -ErrorAction Stop).DefaultDistribution
  $defaultDistro = (Get-ItemProperty -LiteralPath ($lxss + '\' + $defaultId) -ErrorAction Stop).DistributionName
} catch { }
@{ home=$homePath; installations=@($results); defaultWslDistro=$defaultDistro } | ConvertTo-Json -Depth 6 -Compress
`;

export const WSL_DISCOVERY_SCRIPT = String.raw`
import glob, json, os, re
home = os.path.expanduser('~')
paths = os.environ.get('PATH', '').split(os.pathsep)
paths += [os.path.join(home, suffix) for suffix in ('.local/bin', '.cargo/bin', '.bun/bin', '.npm-global/bin')]
paths += sorted(glob.glob(os.path.join(home, '.nvm/versions/node/*/bin')))[:64]
paths = list(dict.fromkeys(p for p in paths if os.path.isabs(p)))[:160]
results = []
def safe(value): return isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,63}', value)
def text(filename):
    try:
        if os.path.getsize(filename) <= 262144:
            with open(filename, encoding='utf-8') as f: return f.read()
    except (OSError, UnicodeError): pass
    return ''
for harness, command in [('hermes','hermes'),('openclaw','openclaw'),('codex','codex'),('claude-code','claude')]:
    profile = os.path.join(home, '.claude' if harness == 'claude-code' else '.' + harness)
    identities = [dict(id='default', label='Default', kind='profile', profilePath=profile)]
    if harness == 'hermes':
        for entry in sorted(glob.glob(os.path.join(profile, 'profiles', '*')))[:64]:
            name = os.path.basename(entry)
            if os.path.isdir(entry) and safe(name): identities.append(dict(id=name, label=name, kind='profile', profilePath=entry))
    if harness == 'claude-code':
        for entry in sorted(glob.glob(os.path.join(profile, 'agents', '*.md')))[:64]:
            name = os.path.basename(entry)[:-3]
            if safe(name): identities.append(dict(id=name, label=name, kind='agent', profilePath=profile))
    if harness == 'codex':
        for match in re.finditer(r'^\s*\[profiles\.(?:"([A-Za-z0-9._-]+)"|([A-Za-z0-9._-]+))\]\s*(?:#.*)?$', text(os.path.join(profile, 'config.toml')), re.M):
            name = match.group(1) or match.group(2)
            if safe(name) and name != 'default' and len(identities) <= 64: identities.append(dict(id=name, label=name, kind='profile', profilePath=profile))
    if harness == 'openclaw':
        identities = [dict(id='main', label='Main', kind='agent', profilePath=profile)]
        try:
            agents = json.loads(text(os.path.join(profile, 'openclaw.json'))).get('agents', {}).get('list', [])
            found = [dict(id=a['id'], label=a['id'], kind='agent', profilePath=profile) for a in agents if isinstance(a, dict) and safe(a.get('id'))][:64]
            if found: identities = found
        except (ValueError, AttributeError, TypeError): pass
    seen = set()
    for directory in paths:
        candidate = os.path.join(directory, command)
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            resolved = os.path.realpath(candidate)
            if resolved not in seen and len(seen) < 32:
                seen.add(resolved)
                results.append(dict(adapterId=harness, executablePath=candidate, canonicalExecutablePath=resolved, identities=identities))
print(json.dumps(dict(home=home, installations=results)))
`;
