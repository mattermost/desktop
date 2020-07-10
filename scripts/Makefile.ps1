# We would have preferred to put this main section to the end of the script,
# but PowerSchell script arguments must be defined as the first statement in
# a PowerShell script.
Param (
    [parameter(Position=0)]$makeRule
)

# imports
# these should be better with modules, but we would have to install them on circleci servers

# import tools
. .\scripts\tools.ps1

# import dependencies functions
. .\scripts\dependencies.ps1

################################################################################
# Appveyor related functions
################################################################################
#region

function Is-AppVeyor {
    if ($env:APPVEYOR -eq $True) {
        return $True
    }
    return $False
}

function Enable-AppVeyorRDP {
    if (-not (Is-AppVeyor)) {
        Print-Error "You are not running on AppVeyor. Enabling RDP will be bypassed."
        return
    }
    # src.: https://www.appveyor.com/docs/how-to/rdp-to-build-worker/
    $blockRdp = $true;
    iex ((new-object net.webclient).DownloadString(
        "https://raw.githubusercontent.com/appveyor/ci/master/scripts/enable-rdp.ps1"
    ))
}

#endregion

################################################################################
# Mattermost related functions
################################################################################
#region

function Prepare-Path {

    # As we may need to install new dependencies, make sure the PATH env
    # variable is not too large. Some CI envs like AppVeyor have already the
    # PATH env variable defined at the maximum which prevents new strings to
    # be added to it. We will remove all the stuff added for programs in
    # Program Files (64 bits and 32 bits variants) except the path of our
    # dependencies.
    # src.: https://gist.github.com/wget/a102f89c301014836aaa49a98dd06ee2
    $oldPath = $env:Path

    [array]$newPath
    # Cleanup the PATH from everything contained in Program Files...
    $newPath = ($env:Path -split ';') | Where-Object { $_ -notlike "C:\Program Files*" }
    # ...except from Git
    $newPath += ($env:Path -split ';') | Where-Object { $_ -like "C:\Program Files*\*Git*" }
    $env:Path = $newPath -join ';'
    Print-Info "Reducing and reordering PATH from `n    ""$oldPath""`n    to`n    ""$env:Path"""

    # Prepending ensures we are using our own path here to avoid the paths the
    # user might have defined to interfere.

    # Prepend the PATH with npm/nodejs dir
    Print-Info "Checking if npm dir is already in the PATH..."
    $env:Path = "$(Get-NpmDir)" + ";" + $env:Path

    # Prepend the PATH with wix dir
    Print-Info "Checking if wix dir is already in the PATH..."
    $env:Path = "$(Get-WixDir)" + ";" + $env:Path

    # Prepend the PATH with signtool dir
    Print-Info "Checking if signtool dir is already in the PATH..."
    $env:Path = "$(Get-SignToolDir)" + ";" + $env:Path
}

function Catch-Interruption {
    [console]::TreatControlCAsInput = $true
    while ($true) {
        if ([console]::KeyAvailable) {
            $key = Read-Host
            #$key = [system.console]::readkey($true)
            if (($key.modifiers -band [consolemodifiers]"control") -and
                ($key.key -eq "C")) {
                Print-Warning "Ctrl-C pressed. Cancelling the build process and restoring computer state..."
                Restore-ComputerState
                exit
            }
        }
    }
}

function Backup-ComputerState {
    $env:COM_MATTERMOST_MAKEFILE_PATH_BACKUP = $env:Path

    Push-Location "$(Get-RootDir)"
    # Needed because for native apps, PowerShell doesn't change the
    # process current path location
    #src.: https://stackoverflow.com/a/4725090/3514658
    [Environment]::CurrentDirectory = $PWD

    # Refresh path because it might have been made durty in the current shell
    Refresh-Path
}

function Restore-ComputerState {

    Print-Info "Restoring PATH..."
    $env:Path = $env:COM_MATTERMOST_MAKEFILE_PATH_BACKUP

    Print-Info "Restoring current working directory..."
    Pop-location
    [Environment]::CurrentDirectory = $PWD

    # Remove all COM_MATTERMOST_MAKEFILE_ prefixed env variable
    foreach ($item in (Get-Item -Path Env:*)) {
        if ($item.Name -imatch 'COM_MATTERMOST_MAKEFILE_') {
            Print-Info "Removing Mattermost env variable: $($item.Name)..."
            Remove-Item env:\$($item.Name)
        }
    }
}


function Optimize-Build {
    Print-Info "Checking if Windows Search is running..."
    if ((Get-Service -Name "Windows Search").Status -eq "Running") {
        Print-Info "Windows Search is running. Disabling it..."
        Stop-Service "Windows Search"
        Print-Warning "WARNING: This makefile disabled Windows Search, to reenable it, type in an administror Powershell: Start-Service ""Windows Search"""
    } else {
        Print-Info "Windows Search has already been disabled."
    }

    Print-Info "Checking if Windows Defender realtime protection is active..."
    if (!(Get-MpPreference).DisableRealtimeMonitoring) {
        Print-Info "Windows Defender realtime protection is active. Disabling it..."
        Set-MpPreference -DisableRealtimeMonitoring $true
        Print-Warning "WARNING: This makefile disabled Windows Defender realtime protection, to reenable it, type in an administror Powershell: Set-MpPreference -DisableRealtimeMonitoring `$false"
    } else {
        Print-Info "Windows Defender realtime protection has already been disabled."
    }
}

function Run-BuildId {
    Print-Info -NoNewLine "Getting build date..."
    $env:COM_MATTERMOST_MAKEFILE_BUILD_DATE = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd")
    Print " [$env:COM_MATTERMOST_MAKEFILE_BUILD_DATE]"

    # Generate build version ids
    # 
    # nodejs/npm does require to have semver parsable versions:
    # major.minor.patch
    # Non number values are allowed only if they are not starting the dot verion.
    # 4.3.0-rc2 is allowed but 4.3.rc2 is not
    #
    # wix toolset supports semver up to the revision dot syntax:
    # major.minor.patch.revision.
    # ProductVersion Property is defined as
    # [0-255].[0-255].[0-65535]
    # 8      , 8     , 16 signed bit
    # File Version is defined as
    # [0-65535].[0-65535].[0-65535].[0-65535]
    # 16       , 16      , 16      , 16 signed bit
    #
    # Other chars other than numbers should be removed.
    # Versions like v4.3.0-rc0 shoud be. We are thus forcing to
    # have a format like 4.3.0.rc0.
    # When the last tag is not present or not a parsable semver version, we are
    # taking the number of revisions reachable from the HEAD of the current branch
    # (other branches are not taken into account).
    # Example:
    # $ git rev-list --count --first-parent HEAD
    # 645
    # Using the date is unreliable, because this requires to have a precision at
    # seconds, leading to an overflow of the integer range supported by wix.
    # 4.3.0.20190512074020 is not accepted and fails with the following error:
    # candle.exe : error CNDL0001 : Value was either too large or too small for an Int32.
    # Exception Type: System.OverflowException
    # Add the revision only if we are not building a tag

    $version = "$(jq -r '.version' package.json)"
    $winVersion = "$($version -Replace '-','.' -Replace '[^0-9.]')"

    Print-Info "Checking build id tag validity... [$version]"
    [version]$appVersion = New-Object -TypeName System.Version
    [void][version]::TryParse($winVersion, [ref]$appVersion)
    if (!($appVersion)) {
        # if we couldn't parse, it might be a -develop or something similar, so we just add a 
        # number there that will change overtime. Most likely this is a PR to be tested
        $revision = "$(git rev-list --all --count)"
        $winVersion = "$($version -Replace '-.*').${revision}"
        [void][version]::TryParse($winVersion, [ref]$appVersion)
        if (!($appVersion)) {
            Print-Error "Non parsable tag detected. Fallbacking to version 0.0.0."
            $version = "0.0.0"
        }
    }

    Print-Info -NoNewLine "Getting build id version..."
    $env:COM_MATTERMOST_MAKEFILE_BUILD_ID = "$version"
    Print " [$env:COM_MATTERMOST_MAKEFILE_BUILD_ID]"

    Print-Info -NoNewLine "Getting build id version for msi..."
    $env:COM_MATTERMOST_MAKEFILE_BUILD_ID_MSI = $winVersion.Split('.')[0..3] -Join '.'
    Print " [$env:COM_MATTERMOST_MAKEFILE_BUILD_ID_MSI]"

    Print-Info -NoNewLine "Getting build id version for node/npm..."
    $env:COM_MATTERMOST_MAKEFILE_BUILD_ID_NODE = $version
    Print " [$env:COM_MATTERMOST_MAKEFILE_BUILD_ID_NODE]"

    Print-Info "Patching version from msi xml descriptor..."
    $msiDescriptorFileName = "scripts\msi_installer.wxs"
    $msiDescriptor = [xml](Get-Content $msiDescriptorFileName)
    $msiDescriptor.Wix.Product.Version = [string]$env:COM_MATTERMOST_MAKEFILE_BUILD_ID_MSI
    $ComponentDownload = $msiDescriptor.CreateElement("Property", "http://schemas.microsoft.com/wix/2006/wi")
    $ComponentDownload.InnerText = "https://releases.mattermost.com/desktop/$version/mattermost-desktop-$version-`$(var.Platform).msi"
    $ComponentDownload.SetAttribute("Id", "ComponentDownload")
    $msiDescriptor.Wix.Product.AppendChild($ComponentDownload)
    $msiDescriptor.Save($msiDescriptorFileName)
    Print-Info "Modified Wix XML"
}

function Run-BuildChangelog {
    Print-Info "Getting list of commits for changelog..."
    $previousTag = $(Invoke-Expression "git describe --abbrev=0 --tags $(git describe --abbrev=0)^")
    if ($env:APPVEYOR_REPO_TAG -eq $true) {
        $currentTag = [string]$(git describe --abbrev=0)
    } else {
        $currentTag = [string]"HEAD"
    }
    $changelogRaw = "$(git log --oneline --since=""$(git log -1 ""$previousTag"" --pretty=%ad)"" --until=""$(git log -1 "$currentTag" --pretty=%ad)"")"
    $changelog = "";
    foreach ($i in $changelogRaw) {
        $changelog += "* $i`n"
    }
    $env:COM_MATTERMOST_MAKEFILE_BUILD_CHANGELOG = $changelog
}

function Run-BuildElectron {
    Print-Info "Installing nodejs/electron dependencies (running npm ci)..."
    npm ci
    #npm install --prefix="$(Get-RootDir)" "$(Get-RootDir)"
    Print-Info "Building nodejs/electron code (running npm run build)..."
    npm run build
    #npm run build --prefix="$(Get-RootDir)" "$(Get-RootDir)"
    Print-Info "Packaging nodejs/electron for Windows (running npm run package:windows)..."
    npm run package:windows
    #npm run package:windows --prefix="$(Get-RootDir)" "$(Get-RootDir)"

    Print-Info "Cleaning build dir..."
    Remove-Item "release\win-ia32-unpacked\resources\app.asar.unpacked\" -Force -Recurse
    Remove-Item "release\win-unpacked\resources\app.asar.unpacked\" -Force -Recurse
}

function Run-BuildForceSignature {
    # Only sign the executable and .dll if this is a release and not a pull request
    # check.
    if ($env:APPVEYOR_REPO_TAG -eq $true) {
        Print-Info "Enforcing signature of the executable and dll..."

        # Decrypt the certificate. The decrypted version will be at
        # .\resources\windows\certificate\mattermost-desktop-windows.pfx
        iex ((New-Object Net.WebClient).DownloadString(
            "https://raw.githubusercontent.com/appveyor/secure-file/master/install.ps1"
        ))
        # Secure variables are never decoded during Pull Request
        # except if the repo is private and a secure org has been created
        # src.: https://www.appveyor.com/docs/build-configuration/#secure-variables
        & "appveyor-tools\secure-file" -decrypt "resources\windows\certificate\mattermost-desktop-windows.pfx.enc" -secret "$env:COM_MATTERMOST_MAKEFILE_CERTIFICATE_DECRYPTION_KEY_ENCRYPTED"

        foreach ($archPath in "release\win-unpacked", "release\win-ia32-unpacked") {

            # Note: The C++ redistribuable files will be resigned again even if they have a
            # correct signature from Microsoft. Windows doesn't seem to complain, but we
            # don't know whether this is authorized by the Microsoft EULA.
            Get-ChildItem -Path $archPath -recurse "*.dll" | ForEach-Object {
                Print-Info "Signing $($_.Name) (waiting for 2 * 15 seconds)..."
                # Waiting for at least 15 seconds is needed because these time
                # servers usually have rate limits and signtool can fail with the
                # following error message:
                # "SignTool Error: The specified timestamp server either could not be reached or returned an invalid response.
                # src.: https://web.archive.org/web/20190306223053/https://github.com/electron-userland/electron-builder/issues/2795#issuecomment-466831315
                Start-Sleep -s 15
                signtool.exe sign /f "resources\windows\certificate\mattermost-desktop-windows.pfx" /p "$env:COM_MATTERMOST_MAKEFILE_CERTIFICATE_PRIVATE_KEY_ENCRYPTED" /tr "http://timestamp.digicert.com" /fd sha1 /td sha1 "$($_.FullName)"
                Start-Sleep -s 15
                signtool.exe sign /f "resources\windows\certificate\mattermost-desktop-windows.pfx" /p "$env:COM_MATTERMOST_MAKEFILE_CERTIFICATE_PRIVATE_KEY_ENCRYPTED" /tr "http://timestamp.digicert.com" /fd sha256 /td sha256 /as "$($_.FullName)"
            }

            Print-Info "Signing Mattermost.exe (waiting for 2 * 15 seconds)..."
            Start-Sleep -s 15
            signtool.exe sign /f "resources\windows\certificate\mattermost-desktop-windows.pfx" /p "$env:COM_MATTERMOST_MAKEFILE_CERTIFICATE_PRIVATE_KEY_ENCRYPTED" /tr "http://timestamp.digicert.com" /fd sha1 /td sha1 "$archPath\Mattermost.exe"
            Start-Sleep -s 15
            signtool.exe sign /f "resources\windows\certificate\mattermost-desktop-windows.pfx" /p "$env:COM_MATTERMOST_MAKEFILE_CERTIFICATE_PRIVATE_KEY_ENCRYPTED" /tr "http://timestamp.digicert.com" /fd sha256 /td sha256 /as "$archPath\Mattermost.exe"
        }
    } elseif (Test-Path 'env:PFX') {
        Print-Info "Signing"
        foreach ($archPath in "release\win-unpacked", "release\win-ia32-unpacked") {
            # Note: The C++ redistribuable files will be resigned again even if they have a
            # correct signature from Microsoft. Windows doesn't seem to complain, but we
            # don't know whether this is authorized by the Microsoft EULA.
            Get-ChildItem -Path $archPath -recurse "*.dll" | ForEach-Object {
                Print-Info "Signing $($_.Name) (waiting for 2 * 15 seconds)..."
                # Waiting for at least 15 seconds is needed because these time
                # servers usually have rate limits and signtool can fail with the
                # following error message:
                # "SignTool Error: The specified timestamp server either could not be reached or returned an invalid response.
                # src.: https://web.archive.org/web/20190306223053/https://github.com/electron-userland/electron-builder/issues/2795#issuecomment-466831315
                Start-Sleep -s 15
                signtool.exe sign /f "./mattermost-desktop-windows.pfx" /p "$env:PFX_KEY" /tr "http://timestamp.digicert.com" /fd sha1 /td sha1 "$($_.FullName)"
                Start-Sleep -s 15
                signtool.exe sign /f "./mattermost-desktop-windows.pfx" /p "$env:PFX_KEY" /tr "http://timestamp.digicert.com" /fd sha256 /td sha256 /as "$($_.FullName)"
            }

            Print-Info "Signing Mattermost.exe (waiting for 2 * 15 seconds)..."
            Start-Sleep -s 15
            signtool.exe sign /f "./mattermost-desktop-windows.pfx" /p "$env:PFX_KEY" /tr "http://timestamp.digicert.com" /fd sha1 /td sha1 "$archPath\Mattermost.exe"
            Start-Sleep -s 15
            signtool.exe sign /f "./mattermost-desktop-windows.pfx" /p "$env:PFX_KEY" /tr "http://timestamp.digicert.com" /fd sha256 /td sha256 /as "$archPath\Mattermost.exe"
        }
    } else {
        Print-Info "DLLs not signed"
    }
}


function Run-BuildLicense {

    # Convert license to RTF
    $licenseTxtFile = "LICENSE.txt";
    $licenseRtfFile = "resources/windows/license.rtf";
    $licenseNewParagraph = "\par" + [Environment]::NewLine;
    $sw = [System.IO.File]::CreateText($licenseRtfFile);
    $sw.WriteLine("{\rtf1\ansi\deff0\nouicompat{\fonttbl{\f0\fnil\fcharset0 Courier New;}}\pard\qj\f0\fs18");
    $lineToAdd = "";
    $gapDetected = 0;
    # We are relying on introspected C#/.NET rather than the buggy Get-Content
    # cmdlet because Get-Content considers by default a `-Delimiter` to '\n'
    # and thus breaks the purpose of the parser.
    foreach ($line in [System.IO.File]::ReadLines($licenseTxtFile)) {
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
}

function Run-BuildMsi {
    Print-Info "Building 32 bits msi installer..."
    heat.exe dir "release\win-ia32-unpacked\" -o "scripts\msi_installer_files.wxs" -scom -frag -srd -sreg -gg -cg MattermostDesktopFiles -t "scripts\msi_installer_files_replace_id.xslt" -dr INSTALLDIR
    candle.exe -dPlatform=x86 "scripts\msi_installer.wxs" "scripts\msi_installer_files.wxs" -o "scripts\"
    light.exe "scripts\msi_installer.wixobj" "scripts\msi_installer_files.wixobj" -loc "resources\windows\msi_i18n\en_US.wxl" -o "release\mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x86.msi" -b "release\win-ia32-unpacked\"

    Print-Info "Building 64 bits msi installer..."
    heat.exe dir "release\win-unpacked\" -o "scripts\msi_installer_files.wxs" -scom -frag -srd -sreg -gg -cg MattermostDesktopFiles -t "scripts\msi_installer_files_replace_id.xslt" -t "scripts\msi_installer_files_set_win64.xslt" -dr INSTALLDIR
    candle.exe -dPlatform=x64 "scripts\msi_installer.wxs" "scripts\msi_installer_files.wxs" -o "scripts\"
    light.exe "scripts\msi_installer.wixobj" "scripts\msi_installer_files.wixobj" -loc "resources\windows\msi_i18n\en_US.wxl" -o "release\mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x64.msi" -b "release\win-unpacked\"

    # Only sign the executable and .dll if this is a release and not a pull request
    # check.
    if ($env:APPVEYOR_REPO_TAG -eq $true) {
        Print-Info "Signing mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x86.msi (waiting for 15 seconds)..."
        Start-Sleep -s 15
        # Dual signing is not supported on msi files. Is it recommended to sign with 256 hash.
        # src.: https://security.stackexchange.com/a/124685/84134
        # src.: https://social.msdn.microsoft.com/Forums/windowsdesktop/en-us/d4b70ecd-a883-4289-8047-cc9cde28b492#0b3e3b80-6b3b-463f-ac1e-1bf0dc831952
        signtool.exe sign /f "resources\windows\certificate\mattermost-desktop-windows.pfx" /p "$env:COM_MATTERMOST_MAKEFILE_CERTIFICATE_PRIVATE_KEY_ENCRYPTED" /tr "http://timestamp.digicert.com" /fd sha256 /td sha256 /d "mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x86.msi" "release\mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x86.msi"

        Print-Info "Signing mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x64.msi (waiting for 15 seconds)..."
        Start-Sleep -s 15
        signtool.exe sign /f "resources\windows\certificate\mattermost-desktop-windows.pfx" /p "$env:COM_MATTERMOST_MAKEFILE_CERTIFICATE_PRIVATE_KEY_ENCRYPTED" /tr "http://timestamp.digicert.com" /fd sha256 /td sha256 /d "mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x64.msi" "release\mattermost-desktop-\$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x64.msi"
    } elseif (Test-Path 'env:PFX') {
        Print-Info "Signing mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x86.msi (waiting for 15 seconds)..."
        Start-Sleep -s 15
        # Dual signing is not supported on msi files. Is it recommended to sign with 256 hash.
        # src.: https://security.stackexchange.com/a/124685/84134
        # src.: https://social.msdn.microsoft.com/Forums/windowsdesktop/en-us/d4b70ecd-a883-4289-8047-cc9cde28b492#0b3e3b80-6b3b-463f-ac1e-1bf0dc831952
        signtool.exe sign /f "./mattermost-desktop-windows.pfx" /p "$env:PFX_KEY" /tr "http://timestamp.digicert.com" /fd sha256 /td sha256 /d "release\mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x86.msi" "release\mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x86.msi"

        Print-Info "Signing mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x64.msi (waiting for 15 seconds)..."
        Start-Sleep -s 15
        signtool.exe sign /f "./mattermost-desktop-windows.pfx" /p "$env:PFX_KEY" /tr "http://timestamp.digicert.com" /fd sha256 /td sha256 /d "release\mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x64.msi" "release\mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x64.msi"
    } else {
        Print-Info "Not signing msi"
    }
}

function Get-Cert {
    if (Test-Path 'env:PFX') {
        Print-Info "Getting windows certificate"
        [IO.File]::WriteAllBytes("./mattermost-desktop-windows.pfx", [Convert]::FromBase64String($env:PFX))
        $password = "$env:PFX_KEY" | convertto-securestring -asplaintext -force
        Print-Info "Importing certificate into the machine"
        Import-PfxCertificate -filepath "./mattermost-desktop-windows.pfx" cert:\localMachine\my -password $password
    } else {
        Print-Warning "No variable environment found, build will not be signed"
    }
}

function Remove-Cert {
    if (Test-Path 'env:PFX') {
        Print-Info "Removing windows certificate"
        Remove-Item -path "./mattermost-desktop-windows.pfx"
    }
}

function Run-Build {
    Check-Deps -Verbose -Throwable
    Prepare-Path
    Get-Cert
    Run-BuildId
    Run-BuildChangelog
    Run-BuildElectron
    Run-BuildForceSignature
    Run-BuildLicense
    Run-BuildMsi
    Remove-Cert
}

function Run-Test {
    Check-Deps -Verbose -Throwable
    Prepare-Path
    npm test
}
#endregion

################################################################################
# Main function
################################################################################
#region
function Main {
    try {
        if ($makeRule -eq $null) {
            Print-Info "No argument passed to the make file. Executing ""all"" rule."
            $makeRule = "all"
        }

        Backup-ComputerState

        switch ($makeRule.toLower()) {
            "all" {
                Install-Deps
                Run-Build
            }
            "build" {
                Run-Build
            }
            "test" {
                Run-Test
            }
            "install-deps" {
                Install-Deps
            }
            "optimize" {
                Optimize-Build
            }
            "debug" {
                Enable-AppVeyorRDP
            }
            "install-cert" {
                Get-Cert
            }
            "remove-cert" {
                Remove-Cert
            }
            default {
                Print-Error "Makefile argument ""$_"" is invalid. Build process aborted."
            }
        }

        $env:COM_MATTERMOST_MAKEFILE_EXECUTION_SUCCESS = $true
        $exitcode = 0

    } catch {
        switch ($_.Exception.Message) {
            "com.mattermost.makefile.deps.missing" {
                Print-Error "The following dependencies are missing: $($missing -Join ', ').`n    Please install dependencies as an administrator:`n    # makefile.ps1 install-deps"
                $exitcode = -1
            }
            "com.mattermost.makefile.deps.notadmin" {
                Print-Error "Installing dependencies requires admin privileges. Operation aborted.`n    Please reexecute this makefile as an administrator:`n    # makefile.ps1 install-deps"
                $exitcode = -2
            }
            "com.mattermost.makefile.deps.wix" {
                Print-Error "There was nothing wrong with your source code,but we found a problem installing wix toolset and couldn't continue. please try re-running the job."
                $exitcode = -3
            }   
            default {          
                Print-Error "Another error occurred: $_"
                $exitcode = -100
            }
        }
    } finally {
        if (!($env:COM_MATTERMOST_MAKEFILE_EXECUTION_SUCCESS)) {
            Print-Warning "Makefile interrupted by Ctrl + C or by another interruption handler."
        }
        Restore-ComputerState
        exit $exitcode
    }
}

Main
#endregion

