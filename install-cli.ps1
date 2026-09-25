# install-cli.ps1 — the standalone `fluid` binary on Windows, for projects without Node.
#
#   irm https://raw.githubusercontent.com/gabros20/fluid-design-skill/main/install-cli.ps1 | iex
#
# Env: FLUID_VERSION=v2.0.0 (default: latest), FLUID_INSTALL_DIR (default: %LOCALAPPDATA%\fluid)
# Checks the download against the release's SHA256SUMS before installing.
$ErrorActionPreference = 'Stop'
$repo = 'gabros20/fluid-design-skill'
$dir = if ($env:FLUID_INSTALL_DIR) { $env:FLUID_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'fluid' }
$asset = 'fluid-windows-x64.exe'
$base = if ($env:FLUID_VERSION) { "https://github.com/$repo/releases/download/$($env:FLUID_VERSION)" } else { "https://github.com/$repo/releases/latest/download" }
$tmp = New-Item -ItemType Directory -Path (Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid()))
try {
  Invoke-WebRequest "$base/$asset" -OutFile (Join-Path $tmp $asset)
  Invoke-WebRequest "$base/SHA256SUMS" -OutFile (Join-Path $tmp 'SHA256SUMS')
  $line = Get-Content (Join-Path $tmp 'SHA256SUMS') | Where-Object { $_ -match " $([regex]::Escape($asset))$" }
  $expected = ($line -split ' ')[0]
  $actual = (Get-FileHash (Join-Path $tmp $asset) -Algorithm SHA256).Hash.ToLower()
  if (-not $expected -or $expected -ne $actual) { throw "fluid: checksum mismatch for $asset. Not installing." }
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Move-Item -Force (Join-Path $tmp $asset) (Join-Path $dir 'fluid.exe')
  Write-Host "fluid: installed $(& (Join-Path $dir 'fluid.exe') --version) to $dir\fluid.exe"
  if (-not ($env:Path -split ';' | Where-Object { $_ -eq $dir })) {
    Write-Host "fluid: add $dir to your PATH:  [Environment]::SetEnvironmentVariable('Path', `"$dir;`" + [Environment]::GetEnvironmentVariable('Path','User'), 'User')"
  }
  Write-Host 'Next, in your project:  fluid init'
} finally { Remove-Item -Recurse -Force $tmp }
