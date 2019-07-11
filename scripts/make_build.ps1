# We would have preferred to put this main section to the end of the script,
# but PowerSchell script arguments must be defined as the first statement in
# a PowerShell script.
Param (
    [parameter(Position=0)]$makeRule
)

################################################################################
# Common util functions
################################################################################
#region

function Print {
     Param (
        [String]$message,
        [Switch]$NoNewLine
    )
    if ($NoNewLine) {
        [Console]::Write($message)
    } else {
        [Console]::WriteLine($message)
    }
}

function Print-Info {
    Param (
        [String]$message,
        [Switch]$NoNewLine,
        [Switch]$NoPrefix
    )
    if ([String]::IsNullOrEmpty($message)) {
        return
    }

    [Console]::ResetColor()
    [Console]::Write("[")
    [Console]::ForegroundColor = 'green'
    [Console]::Write("+")
    [Console]::ResetColor()

    if ($NoNewLine) {
        [Console]::Write("] " + $message)
    } else {
        [Console]::WriteLine("] " + $message)
    }
}

# Avoid stacktrace to be displayed along side the error message.
# We want things simplistic.
# src.: https://stackoverflow.com/q/38064704/3514658
function Print-Error {
    Param (
        [String]$message,
        [Switch]$NoNewLine,
        [Switch]$NoPrefix
    )
    if ([String]::IsNullOrEmpty($message)) {
        return
    }

    [Console]::ResetColor()
    [Console]::Error.Write("[")
    [Console]::ForegroundColor = 'red'
    [Console]::Error.Write("-")
    [Console]::ResetColor()

    if ($NoNewLine) {
        [Console]::Write("] " + $message)
    } else {
        [Console]::WriteLine("] " + $message)
    }
}

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
        'https://raw.githubusercontent.com/appveyor/ci/master/scripts/enable-rdp.ps1'
    ))
}

# Inspiration taken from here:
# src.: https://wiki.archlinux.org/index.php/VCS_package_guidelines#Git
function Get-GitVersion {
    Param (
        [Switch]$WithRev
    )

    $version = [string]$(git describe --abbrev=0)
    $rev = [string]$(git rev-list --count --first-parent HEAD)

    # Returns if the semver is parsable
    if ($version) {
        if ($WithRev) {
            return $version + "." + $rev
        }
        return $version
    }

    # Otherwise returns the revision number (number of commits reachable from
    # the root from the current branch)
    return $rev
}

function Get-GitVersionSemver {
    Param (
        [Switch]$WithRev
    )

    # Try to get the major.minor.patch version from the latest reachable tag and sanitize it
    $semver = [string]$(git describe --abbrev=0) -Replace '-','.' -Replace '[^0-9.]'
    # Take the 3 first numbers
    $semver = $semver.Split('.')[0..2] -Join '.'

    [version]$appVersion = New-Object -TypeName System.Version
    [void][version]::TryParse($semver, [ref]$appVersion)

    $rev = [string]$(git rev-list --count --first-parent HEAD)
    if ($appVersion) {
        if ($WithRev) {
            return $semver + "." + $rev
        }
        return $semver
    }
    
    return $rev
}

function Get-GitDateRevision {
    $rev = [string]$(git rev-list --count --first-parent HEAD)
    return  (Get-Date).ToUniversalTime().ToString("yyyyMMdd") + "." + $rev + ".0"
}

function Check-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

# src: https://superuser.com/a/756696/456258
function Is-Admin {
    return ([Security.Principal.WindowsPrincipal] `
            [Security.Principal.WindowsIdentity]::GetCurrent() `
            ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-WixDir {
    $progFile = (${env:ProgramFiles(x86)}, ${env:ProgramFiles} -ne $null)[0]
    $wixDirs = @(Get-ChildItem -Path $progFile -Recurse -Filter "*wix toolset*" -Attributes Directory -Depth 2)
    if ($wixDirs[0] -eq $null) {
        return $null
    }
    $wixDir = Join-Path -Path "$progFile" -ChildPath "$($wixDirs[0])"
    $wixDir = Join-Path -Path "$wixDir" -ChildPath "bin"
    return $wixDir
}

function Get-SignToolDir {
    $progFile = (${env:ProgramFiles(x86)}, ${env:ProgramFiles} -ne $null)[0]
    $signToolDir = Join-Path -Path "$progFile" -ChildPath "Windows Kits\10\bin\"
    # Check if we are on 64 bits or not.
    if ($env:PROCESSOR_ARCHITECTURE -ilike '*64*') {
        $arch = "x64"
    } else {
        $arch = "x86"
    }
    [array]$signToolExes = (
        Get-ChildItem -Path "$signToolDir" -Filter "signtool.exe" -Recurse -ErrorAction SilentlyContinue -Force | % {
            if ($_.FullName -ilike '*x64*') {
                return $_.FullName;
            }
        }
    )
    if ($signToolExes -eq $null -or
        [string]::IsNullOrEmpty($signToolExes[0])) {
        return $null
    }

    if (Test-Path $signToolExes[0]) {
        return Split-Path $signToolExes[0]
    }
    return $null
}

function Get-NpmDir {
    # npm is always installed as a nodejs dependency. 64 bits version available.
    # C:\Program Files\nodejs\npm with a shortcut leading to
    # C:\Program Files\nodejs\node_modules\npm\bin
    $progFile = ${env:ProgramFiles}
    $npmDir = Join-Path -Path "$progFile" -ChildPath "nodejs"
    if ([System.IO.File]::Exists("$npmDir\npm.cmd")) {
        return $npmDir
    }
    return $null
}
#endregion

################################################################################
# Mattermost related functions
################################################################################
#region
function Check-Deps {
    Param (
        [Switch]
        $verbose
    )

    if ($PSVersionTable.PSVersion.Major -lt 5) {
        Print-Error "You need at least PowerShell 5.0 to execute this Makefile. Operation aborted."
        exit
    }

    [array]$missing = @()

    if ($verbose) { Print-Info "Checking choco dependency..." }
    if (!(Check-Command "choco")) {
        if ($verbose) { Print-Error "choco dependency missing." }
        $missing += "choco"
    }

    if ($verbose) { Print-Info "Checking git dependency..." }
    if (!(Check-Command "git")) {
        if ($verbose) { Print-Error "git dependency missing." }
        $missing += "git"
    }

    if ($verbose) { Print-Info "Checking nodejs/npm dependency..." }
    # Testing if the folder is not empty first is needed otherwise if there is
    # a file called like that in the path where the makefile is invocated, the
    # check will succeed while it is plain wrong.
    if ([string]::IsNullOrEmpty($(Get-NpmDir)) -or
        # We could have used the builtin Test-Path cmdlet instead but it is
        # tested for folders as well. We need to test for a file existence
        # here.  
        ![System.IO.File]::Exists("$(Get-NpmDir)\npm.cmd") -or
        ![System.IO.File]::Exists("$(Get-NpmDir)\node.exe")) {
            if ($verbose) { Print-Error "nodejs/npm dependency missing." }
        $missing += "npm"
    }

    if ($verbose) { Print-Info "Checking wix dependency..." }
    if ([string]::IsNullOrEmpty($(Get-WixDir)) -or
        ![System.IO.File]::Exists("$(Get-WixDir)\heat.exe") -or
        ![System.IO.File]::Exists("$(Get-WixDir)\candle.exe") -or
        ![System.IO.File]::Exists("$(Get-WixDir)\light.exe")) {
        if ($verbose) { Print-Error "wix dependency missing." }
        $missing += "wix"
    }

    if ($verbose) { Print-Info "Checking signtool dependency..." }
    if ([string]::IsNullOrEmpty($(Get-SignToolDir)) -or
        ![System.IO.File]::Exists("$(Get-SignToolDir)\signtool.exe")) {
        if ($verbose) { Print-Error "signtool dependency missing." }
        $missing += "signtool"
    }

    return $missing
}

function Prepare-Path {

    # Prepending ensures we are using our own path here to avoid the paths the
    # user might have defined to interfere.

    # Prepend the PATH with npm/nodejs dir
    $env:Path = "$(Get-NpmDir)" + $env:Path
    # Prepend the PATH with wix dir
    $env:Path = "$(Get-WixDir)" + $env:Path
}

function Install-Deps {
    Param (
        [parameter(Position=0)]
        [Array[]]
        $missing,

        [Switch]
        $forceInstall
    )

    if ($forceInstall) {
        $missing = ("choco", "git", "wix", "signtool", "npm")
    }

    if ($missing -eq $null) {
        return
    }

    if (-not (Is-Admin)) {
        Print-Error "Installing dependencies requires admin privileges. Operation aborted.`n    Please reexecute this makefile as an administrator:`n    # makefile.ps1 install-deps"
        exit
    }

    # As we are intending to install new dependencies, make sure the PATH env
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

    foreach ($missingItem in $missing) {
        switch ($missingItem) {
            "choco" {
                Print-Error "Installing chocolatey..."
                Set-ExecutionPolicy Bypass -Scope Process -Force; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
                break;
            }
            "git" {
                Print-Error "Installing git..."
                choco install git --yes
                break;
            }
            "wix" {
                Print-Error "Installing wixtoolset..."
                choco install wixtoolset --yes
                break;
            }
            "signtool" {
                Print-Error "Installing Windows 10 SDK (for signtool)..."
                choco install windows-sdk-10.1 --yes
                break;
            }
            "npm" {
                Print-Error "Installing nodejs-lts (with npm)..."
                choco install nodejs-lts --yes
                break;
            }
        }
    }
}

function Run-Build {

    Print-Info -NoNewLine "Getting build date..."
    $env:MATTERMOST_BUILD_DATE = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd")
    Print " [$env:MATTERMOST_BUILD_DATE]"

    # nodejs/npm does require to have semver parsable versions:
    # major.minor.patch
    # while wix support up to the revision dot syntax:
    # major.minor.patch.revision.
    # Which means chars other than numbers should be removed.
    # They do not like to have versions like v4.3.0-rc0. We are thus forcing to
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
    if ($env:APPVEYOR_REPO_TAG) {
        Print-Info -NoNewLine "Getting build id version..."
        $env:MATTERMOST_BUILD_ID = Get-GitVersion
        Print " [$env:MATTERMOST_BUILD_ID]"

        Print-Info -NoNewLine "Getting build id version for msi..."
        $env:MATTERMOST_BUILD_ID_MSI = Get-GitVersionSemver -WithRev
        Print " [$env:MATTERMOST_BUILD_ID_MSI]"

        Print-Info -NoNewLine "Getting build id version for node/npm..."
        $env:MATTERMOST_BUILD_ID_NODE = Get-GitVersionSemver
        Print " [$env:MATTERMOST_BUILD_ID_NODE]"
    } else {
        Print-Info -NoNewLine "Getting build id version..."
        $env:MATTERMOST_BUILD_ID = Get-GitDateRevision
        Print " [$env:MATTERMOST_BUILD_ID]"

        Print-Info -NoNewLine "Getting build id version for msi..."
        $env:MATTERMOST_BUILD_ID_MSI = Get-GitDateRevision
        Print " [$env:MATTERMOST_BUILD_ID_MSI]"

        Print-Info -NoNewLine "Getting build id version for node/npm..."
        $env:MATTERMOST_BUILD_ID_NODE = Get-GitDateRevision
        Print " [$env:MATTERMOST_BUILD_ID_NODE]"
    }

    Print-Info "Patching version from msi xml descriptor..."
    $msiDescriptorFileName = Join-Path -Path "$(Get-Location)" -ChildPath "scripts\msi_installer.wxs"
    $msiDescriptor = [xml](Get-Content $msiDescriptorFileName)
    $msiDescriptor.Wix.Product.Version = [string]$env:MATTERMOST_BUILD_ID_MSI
    $msiDescriptor.Save($msiDescriptorFileName)

    Print-Info "Patching version from electron package.json..."
    $packageFileName = Join-Path -Path "$(Get-Location)" -ChildPath "package.json"
    $package = Get-Content $packageFileName -Raw | ConvertFrom-Json
    $package.version = [string]$env:MATTERMOST_BUILD_ID_NODE
    $package | ConvertTo-Json | Set-Content $packageFileName

    Print-Info "Patching version from electron src\package.json..."
    $packageFileName = Join-Path -Path "$(Get-Location)" -ChildPath "src\package.json"
    $package = Get-Content $packageFileName -Raw | ConvertFrom-Json
    $package.version = [string]$env:MATTERMOST_BUILD_ID_NODE
    $package | ConvertTo-Json | Set-Content $packageFileName

    Print-Info "Getting list of commits for changelog..."
    $previousTag = $(Invoke-Expression "git describe --abbrev=0 --tags $(git describe --abbrev=0)^")
    if ($env:APPVEYOR_REPO_TAG -eq $true) {
        $currentTag = [string]$(git describe --abbrev=0)
    } else {
        $currentTag = [string]"HEAD"
    }
    $changelogRaw = $(git log --oneline --since="$(git log -1 "$previousTag" --pretty=%ad)" --until="$(git log -1 "$currentTag" --pretty=%ad)")
    $changelog = "";
    foreach ($i in $changelogRaw) {
        $changelog += "* $i`n"
    }
    $env:MATTERMOST_BUILD_CHANGELOG = $changelog

    Print-Info "Installing nodejs/electron dependencies (running npm install)..."
    npm install
    Print-Info "Building nodejs/electron code (running npm run build)..."
    npm run build
    Print-Info "Packaging nodejs/electron for Windows (running npm run package:windows)..."
    npm run package:windows

    # Only sign the executable and .dll if this is a release and not a pull request
    # check.
    if ($env:APPVEYOR_REPO_TAG -eq $true) {
        Print-Info "Enforcing signature of the executable and dll..."

        # Decrypt the certificate. The decrypted version will be at
        # .\resources\windows\certificate\mattermost-desktop-windows.pfx
        iex ((New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/appveyor/secure-file/master/install.ps1'))
        # Secure variables are never decoded during Pull Request
        # except if the repo is private and a secure org has been created
        # src.: https://www.appveyor.com/docs/build-configuration/#secure-variables
        appveyor-tools\secure-file -decrypt .\resources\windows\certificate\mattermost-desktop-windows.pfx.enc -secret "$env:certificate_decryption_key_encrypted"

        foreach ($archPath in "release\win-unpacked", "release\win-ia32-unpacked") {

            # Note: The C++ redistribuable files will be resigned again even if they have a
            # correct signature from Microsoft. Windows doesn't seem to complain, but we
            # don't know whether this is authorized by the Microsoft EULA.
            Get-ChildItem -path $archPath -recurse *.dll | ForEach-Object {
                Print-Info "Signing $($_.FullName) (waiting for 2 * 15 seconds)..."
                # Waiting for at least 15 seconds is needed because these time
                # servers usually have rate limits and signtool can fail with the
                # following error message:
                # "SignTool Error: The specified timestamp server either could not be reached or returned an invalid response.
                # src.: https://web.archive.org/web/20190306223053/https://github.com/electron-userland/electron-builder/issues/2795#issuecomment-466831315
                Start-Sleep -s 15
                signtool.exe sign /f .\resources\windows\certificate\mattermost-desktop-windows.pfx /p $env:certificate_private_key_encrypted /tr http://timestamp.digicert.com /fd sha1 /td sha1 $_.FullName
                Start-Sleep -s 15
                signtool.exe sign /f .\resources\windows\certificate\mattermost-desktop-windows.pfx /p $env:certificate_private_key_encrypted /tr http://timestamp.digicert.com /fd sha256 /td sha256 /as $_.FullName
            }

            Print-Info "Signing $archPath\Mattermost.exe (waiting for 2 * 15 seconds)..."
            Start-Sleep -s 15
            signtool.exe sign /f .\resources\windows\certificate\mattermost-desktop-windows.pfx /p $env:certificate_private_key_encrypted /tr http://timestamp.digicert.com /fd sha1 /td sha1 $archPath\Mattermost.exe
            Start-Sleep -s 15
            signtool.exe sign /f .\resources\windows\certificate\mattermost-desktop-windows.pfx /p $env:certificate_private_key_encrypted /tr http://timestamp.digicert.com /fd sha256 /td sha256 /as $archPath\Mattermost.exe
        }
    }

    Print-Info "Cleaning build dir..."
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

    heat.exe dir .\release\win-ia32-unpacked\ -o .\scripts\msi_installer_files.wxs -scom -frag -srd -sreg -gg -cg MattermostDesktopFiles -t .\scripts\msi_installer_files_replace_id.xslt -dr INSTALLDIR
    candle.exe -dPlatform=x86 .\scripts\msi_installer.wxs .\scripts\msi_installer_files.wxs -o .\scripts\
    light.exe .\scripts\msi_installer.wixobj .\scripts\msi_installer_files.wixobj -loc .\resources\windows\msi_i18n\en_US.wxl -o .\release\mattermost-desktop-$($env:MATTERMOST_BUILD_ID)-x86.msi -b ./release/win-ia32-unpacked/

    heat.exe dir .\release\win-unpacked\ -o .\scripts\msi_installer_files.wxs -scom -frag -srd -sreg -gg -cg MattermostDesktopFiles -t .\scripts\msi_installer_files_replace_id.xslt -t .\scripts\msi_installer_files_set_win64.xslt -dr INSTALLDIR
    candle.exe -dPlatform=x64 .\scripts\msi_installer.wxs .\scripts\msi_installer_files.wxs -o .\scripts\
    light.exe .\scripts\msi_installer.wixobj .\scripts\msi_installer_files.wixobj -loc .\resources\windows\msi_i18n\en_US.wxl -o .\release\mattermost-desktop-$($env:MATTERMOST_BUILD_ID)-x64.msi -b ./release/win-unpacked/

    # Only sign the executable and .dll if this is a release and not a pull request
    # check.
    if ($env:APPVEYOR_REPO_TAG) {
        Print-Info "Signing .\release\mattermost-desktop-$($env:MATTERMOST_BUILD_ID)-x86.msi (waiting for 15 seconds)..."
        Start-Sleep -s 15
        # Dual signing is not supported on msi files. Is it recommended to sign with 256 hash.
        # src.: https://security.stackexchange.com/a/124685/84134
        # src.: https://social.msdn.microsoft.com/Forums/windowsdesktop/en-us/d4b70ecd-a883-4289-8047-cc9cde28b492#0b3e3b80-6b3b-463f-ac1e-1bf0dc831952
        signtool.exe sign /f .\resources\windows\certificate\mattermost-desktop-windows.pfx /p $env:certificate_private_key_encrypted /tr http://timestamp.digicert.com /fd sha256 /td sha256 .\release\mattermost-desktop-$($env:MATTERMOST_BUILD_ID)-x86.msi

        Print-Info "Signing .\release\mattermost-desktop-$($env:MATTERMOST_BUILD_ID)-x64.msi (waiting for 15 seconds)..."
        Start-Sleep -s 15
        signtool.exe sign /f .\resources\windows\certificate\mattermost-desktop-windows.pfx /p $env:certificate_private_key_encrypted /tr http://timestamp.digicert.com /fd sha256 /td sha256 .\release\mattermost-desktop-$($env:MATTERMOST_BUILD_ID)-x64.msi
    }
}

function Run-Test {
    npm test
}
#endregion

################################################################################
# Main function
################################################################################
#region
function Main {
    if ($makeRule -eq $null) {
        Print-Info "No argument passed to the make file. Executing ""all"" rule."
        $makeRule = "all"
    }

    $pathBackup = $env:Path

    switch ($makeRule.toLower()) {
        "all" {
            [array]$missing = Check-Deps -Verbose
            if ($missing.Count -gt 0) {
                Print-Error "The following dependencies are missing: $($missing -Join ', ').`n    Please install dependencies as an administrator:`n    # makefile.ps1 install-deps"
                return
            }
            Prepare-Path
            Run-Build
            Run-Test
        }
        "build" {
            Prepare-Path
            Run-Build
        }
        "test" {
            Prepare-Path
            Run-Test
        }
        "all-debug" {
            Enable-AppVeyorRDP
            [array]$missing = Check-Deps -Verbose
            if ($missing.Count -gt 0) {
                Print-Error "The following dependencies are missing: $($missing -Join ', ').`n    Please install dependencies as an administrator:`n    # makefile.ps1 install-deps"
                return
            }
            Prepare-Path
            Run-Build
            Run-Test
        }
        "build-debug" {
            Enable-AppVeyorRDP
            Run-Build
        }
        "test-debug" {
            Enable-AppVeyorRDP
            Prepare-Path
            Run-Test
        }
        "install-deps" {
            [array]$missing = Check-Deps
            try {
                Install-Deps $missing
            } catch {
                Print-Error "The following error occurred when installing the dependencies: $_"
            } finally {
                [array]$missing = Check-Deps
                $missingString = $missing -Join ', '
                Print-Error "The following dependencies weren't properly installed: ${missingString}.`n    You may need to reinstall the dependencies as an administrator with:`n    # makefile.ps1 install-deps"
            }
        }
        default {
            Print-Error "Make file argument ""$_"" is invalid. Build process aborted."
        }
    }

    $env:Path = $pathBackup
}

Main
#endregion