# The $env:PATH is way too long, which prevents new path to be added to it.
#Remove all the stuff added in Program Files except Git.
# src.: https://gist.github.com/wget/a102f89c301014836aaa49a98dd06ee2
Write-Host "Old PATH: $env:Path"
Write-Host "Reducing PATH..."
[array]$newPath=($env:Path -split ';') | Where-Object { $_ -notlike "C:\Program Files*"}
$newPath += ($env:Path -split ';') | Where-Object { $_ -like "C:\Program Files*\*Git*"}
$env:Path = $newPath -join ';'
[Environment]::SetEnvironmentVariable("Path", $env:Path, [System.EnvironmentVariableTarget]::Machine)
[Environment]::SetEnvironmentVariable("INCLUDE", $env:INCLUDE, [System.EnvironmentVariableTarget]::User)
Write-Host "New PATH: $env:Path"

Write-Host "Updating choco packages..."
choco upgrade all --yes

Write-Host "Installing nodejs-lts..."
choco install nodejs-lts --yes

# npm is always installed as a nodejs dependency. 64 bits version available.
# C:\Program Files\nodejs\node_modules\npm\bin
$progFile = ${env:ProgramFiles}
$npmDir = Join-Path -Path "$progFile" -ChildPath "nodejs"
$env:Path += ";$npmDir"

Write-Host "Installing wixtoolset..."
choco install wixtoolset --yes
# Wixtoolset is always installed as a 32 bits based program.
$progFile = (${env:ProgramFiles(x86)}, ${env:ProgramFiles} -ne $null)[0]
$wixDirs = @(Get-ChildItem -Path $progFile -Recurse -Filter "*wix toolset*" -Attributes Directory -Depth 2)
$wixDir = Join-Path -Path "$progFile" -ChildPath "$($wixDirs[0])"
$wixDir = Join-Path -Path "$wixDir" -ChildPath "bin"
$env:Path += ";$wixDir"

Write-Host "Getting build date..."
[Environment]::SetEnvironmentVariable("MATTERMOST_BUILD_DATE", (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd"), [System.EnvironmentVariableTarget]::User)