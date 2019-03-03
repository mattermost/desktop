Write-Host "Working directory:"
Get-Location
Write-Host "Installing dependencies (running npm install)..."
npm install
Write-Host "Building JS code (running npm run build)..."
npm run build
Write-Host "Packaging for Windows (running npm run package:windows)..."
npm run package:windows

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
