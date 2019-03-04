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

# Add signtool to path
$env:Path += ";C:\Program Files (x86)\Windows Kits\10\bin\x64"

Write-Host "Getting build date..."
[Environment]::SetEnvironmentVariable("MATTERMOST_BUILD_DATE", (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd"), [System.EnvironmentVariableTarget]::User)

Write-Host "Working directory:"
Get-Location
Write-Host "Installing dependencies (running npm install)..."
npm install
Write-Host "Building JS code (running npm run build)..."
npm run build
Write-Host "Packaging for Windows (running npm run package:windows)..."
npm run package:windows

# Only sign the executable and .dll if this is a release and not a pull request
# check.
# Note the C++ redistribuable files will be resigned again even if they have a
# correct signature from Microsoft. Windows doesn't seem to complain, but we
# don't know whether this is authorized by the Microsoft EULA.
if ($env:APPVEYOR_REPO_TAG -eq $true) {
    Write-Host "Enforcing signature of the executable and dll..."

    # Decrypt the certificate. The decrypted version will be at
    # .\resources\windows\certificate\mattermost-desktop-windows.pfx
    iex ((New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/appveyor/secure-file/master/install.ps1'))
    # Secure variables are never decoded during Pull Request
    # except if the repo is private and a secure org has been created
    # src.: https://www.appveyor.com/docs/build-configuration/#secure-variables
    appveyor-tools\secure-file -decrypt .\resources\windows\certificate\mattermost-desktop-windows.pfx.enc -secret %encrypted_cert_private_key%

    foreach ($archPath in "release\win-unpacked", "release\win-ia32-unpacked") {
        Get-ChildItem -path $archPath -recurse *.dll | ForEach-Object {
            signtool.exe /f .\resources\windows\certificate\mattermost-desktop-windows.pfx /p %encrypted_cert_private_key% /tr http://tsa.starfieldtech.com /fd sha1 /td sha1 $_.FullName
            signtool.exe /f .\resources\windows\certificate\mattermost-desktop-windows.pfx /p %encrypted_cert_private_key% /tr http://tsa.starfieldtech.com /fd sha256 /td sha256 /as $_.FullName
        }
    }

}



Write-Host "Cleaning build dir..."
Remove-Item .\release\win-ia32-unpacked\resources\app.asar.unpacked\ -Force -Recurse
Remove-Item .\release\win-unpacked\resources\app.asar.unpacked\ -Force -Recurse

# Convert license to RTF
$licenseTxtFile = "$(Get-Location)/LICENSE.txt";
$licenseRtfFile = "$(Get-Location)/resources/windows/license.rtf";
$licenseNewParagraph = "\par" + [Environment]::NewLine;
$sw = [System.IO.File]::CreateText($licenseRtfFile);
$sw.WriteLine("{\rtf1\ansi\deff0\nouicompat{\fonttbl{\f0\fnil\fcharset0 Courier New;}}\pard\qj\f0\fs18");
$lineToAdd = "";
$gapDetected = 0;
# We are relying on introspected C#/.NET rather than the buggy Get-Content
# cmdlet because Get-Content considers by default a `-Delimiter` to '\n'
# and thus breaks the purpose of the parser.
foreach($line in [System.IO.File]::ReadLines($licenseTxtFile)) {
    # trim() is equivalent to .replace("\ \s+", "")
    # We replace one backslash by two. Since the first arg is a regex,
    # we need to escape it.
    # src.: https://stackoverflow.com/a/31324570/3514658
    $sanitizedLine = $line.trim().replace("\\", "\\").replace("{", "\{").replace("}", "\}");
    # Print previous string gathered if gap detected.
    if ([string]::IsNullOrEmpty($sanitizedLine)) {
        $gapDetected++;
        # For first line keep paragraph definition from document head.
        if ($gapDetected -eq 1) {
            $sw.Write($lineToAdd);
        } elseif ($gapDetected -eq 2) {
            $sw.Write($licenseNewParagraph + $lineToAdd);
        } else {
            $sw.Write($licenseNewParagraph + $lineToAdd + $licenseNewParagraph);
        }
        $lineToAdd = "";
        continue;
    }
    # Keep carriage return for first two blocks comprising Copyright and
    # license name statements.
    if ($gapDetected -lt 3) {
        $lineToAdd += $sanitizedLine + $licenseNewParagraph;
        continue;
    }
    # Do not add heading space if the line begins a new paragraph.
    if ($lineToAdd -eq "") {
        $lineToAdd += $sanitizedLine;
        continue;
    }
    $lineToAdd += " " + $sanitizedLine;
}
if ($lineToAdd -ne "") {
    $sw.Write([Environment]::NewLine + $licenseNewParagraph + $lineToAdd + "\par");
}
$sw.Close();

heat dir .\release\win-ia32-unpacked\ -o .\scripts\msi_installer_files.wxs -scom -frag -srd -sreg -gg -cg MattermostDesktopFiles -t .\scripts\msi_installer_files_replace_id.xslt -dr INSTALLDIR
candle.exe -dPlatform=x86 .\scripts\msi_installer.wxs .\scripts\msi_installer_files.wxs -o .\scripts\
light.exe .\scripts\msi_installer.wixobj .\scripts\msi_installer_files.wixobj -loc .\resources\windows\msi_i18n\en_US.wxl -o .\release\mattermost-desktop-$($env:APPVEYOR_BUILD_NUMBER)-x86.msi -b ./release/win-ia32-unpacked/

heat dir .\release\win-unpacked\ -o .\scripts\msi_installer_files.wxs -scom -frag -srd -sreg -gg -cg MattermostDesktopFiles -t .\scripts\msi_installer_files_replace_id.xslt -t .\scripts\msi_installer_files_set_win64.xslt -dr INSTALLDIR
candle.exe -dPlatform=x64 .\scripts\msi_installer.wxs .\scripts\msi_installer_files.wxs -o .\scripts\
light.exe .\scripts\msi_installer.wixobj .\scripts\msi_installer_files.wixobj -loc .\resources\windows\msi_i18n\en_US.wxl -o .\release\mattermost-desktop-$($env:APPVEYOR_BUILD_NUMBER)-x64.msi -b ./release/win-unpacked/