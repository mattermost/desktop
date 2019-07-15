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
        "https://raw.githubusercontent.com/appveyor/ci/master/scripts/enable-rdp.ps1"
    ))
}

function Check-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

function Refresh-Path {
    $env:Path =
        [System.Environment]::GetEnvironmentVariable("Path", "Machine") +
        ";" +
        [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# src: https://superuser.com/a/756696/456258
function Is-Admin {
    return ([Security.Principal.WindowsPrincipal] `
            [Security.Principal.WindowsIdentity]::GetCurrent() `
            ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-WixDir {
    $progFile = (${env:ProgramFiles(x86)}, ${env:ProgramFiles} -ne $null)[0]
    $wixDirs = @(Get-ChildItem -Path $progFile -Recurse -Filter "*wix toolset*" -Attributes Directory -Depth 2 -ErrorAction SilentlyContinue)
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

function Get-RootDir {
    return "$(Split-Path $PSCommandPath)\..\"
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

    if ($verbose -and $missing.Count -gt 0) {
        
        throw "makefile.deps.missing"
    }

    return $missing
}

function Prepare-Path {

    # As we way need to install new dependencies, make sure the PATH env
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

function Install-Deps {
    [array]$missing = Check-Deps

    if ($missing -eq $null) {
        Print-Info "All dependencies met."
        return
    }

    if (-not (Is-Admin)) {
        throw "makefile.deps.notadmin"
    }

    foreach ($missingItem in $missing) {
        switch ($missingItem) {
            "choco" {
                Print-Info "Installing chocolatey..."
                Set-ExecutionPolicy Bypass -Scope Process -Force; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
                break;
            }
            "git" {
                Print-Info "Installing git..."
                choco install git --yes
                break;
            }
            "wix" {
                Print-Info "Installing wixtoolset..."
                choco install wixtoolset --yes
                break;
            }
            "signtool" {
                Print-Info "Installing Windows 10 SDK (for signtool)..."
                choco install windows-sdk-10.1 --yes
                break;
            }
            "npm" {
                Print-Info "Installing nodejs-lts (with npm)..."
                choco install nodejs-lts --yes
                break;
            }
        }

        Print-Info "Refreshing PATH..."
        Refresh-Path
    }
}

function Run-BuildId {
    Print-Info -NoNewLine "Getting build date..."
    $env:MATTERMOST_BUILD_DATE = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd")
    Print " [$env:MATTERMOST_BUILD_DATE]"

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
    
    Print-Info "Checking build id tag..."    
    if ($env:APPVEYOR_REPO_TAG) {
        $version = "$env:APPVEYOR_REPO_TAG"
    } else {
        $version = "$(git describe --tags $(git rev-list --tags --max-count=1))"
    }

    Print-Info "Checking build id tag validity..."
    [version]$appVersion = New-Object -TypeName System.Version
    [void][version]::TryParse($($version -Replace '-','.' -Replace '[^0-9.]'), [ref]$appVersion)
    if (!($appVersion)) {
        Print-Error "Non parsable tag detected. Fallbacking to version 0.0.0."
        $version = "0.0.0"
    }

    Print-Info -NoNewLine "Getting build id version..."
    $env:MATTERMOST_BUILD_ID = $version
    Print " [$env:MATTERMOST_BUILD_ID]"

    Print-Info -NoNewLine "Getting build id version for msi..."
    $env:MATTERMOST_BUILD_ID_MSI = ($version -Replace '-','.' -Replace '[^0-9.]').Split('.')[0..3] -Join '.'
    Print " [$env:MATTERMOST_BUILD_ID_MSI]"

    Print-Info -NoNewLine "Getting build id version for node/npm..."
    $env:MATTERMOST_BUILD_ID_NODE = ($version -Replace '^v').Split('.')[0..2] -Join '.'
    Print " [$env:MATTERMOST_BUILD_ID_NODE]"

    Print-Info "Patching version from msi xml descriptor..."
    $msiDescriptorFileName = "$(Get-RootDir)\scripts\msi_installer.wxs"
    $msiDescriptor = [xml](Get-Content $msiDescriptorFileName)
    $msiDescriptor.Wix.Product.Version = [string]$env:MATTERMOST_BUILD_ID_MSI
    $msiDescriptor.Save($msiDescriptorFileName)

    Print-Info "Patching version from electron package.json..."
    $packageFileName = "$(Get-RootDir)\package.json"
    $package = Get-Content $packageFileName -Raw | ConvertFrom-Json
    $package.version = [string]$env:MATTERMOST_BUILD_ID_NODE
    $package | ConvertTo-Json | Set-Content $packageFileName

    Print-Info "Patching version from electron src\package.json..."
    $packageFileName = "$(Get-RootDir)\src\package.json"
    $package = Get-Content $packageFileName -Raw | ConvertFrom-Json
    $package.version = [string]$env:MATTERMOST_BUILD_ID_NODE
    $package | ConvertTo-Json | Set-Content $packageFileName
}

function Run-BuildChangelog {
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
}

function Run-BuildElectron {
    Print-Info "Installing nodejs/electron dependencies (running npm install)..."
    npm install
    Print-Info "Building nodejs/electron code (running npm run build)..."
    npm run build
    Print-Info "Packaging nodejs/electron for Windows (running npm run package:windows)..."
    npm run package:windows

    Print-Info "Cleaning build dir..."
    Remove-Item "$(Get-RootDir)\release\win-ia32-unpacked\resources\app.asar.unpacked\" -Force -Recurse
    Remove-Item "$(Get-RootDir)\release\win-unpacked\resources\app.asar.unpacked\" -Force -Recurse
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
        & "$(Get-RootDir)\appveyor-tools\secure-file" -decrypt "resources\windows\certificate\mattermost-desktop-windows.pfx.enc" -secret "$env:certificate_decryption_key_encrypted"

        foreach ($archPath in "$(Get-RootDir)\release\win-unpacked", "$(Get-RootDir)\release\win-ia32-unpacked") {

            # Note: The C++ redistribuable files will be resigned again even if they have a
            # correct signature from Microsoft. Windows doesn't seem to complain, but we
            # don't know whether this is authorized by the Microsoft EULA.
            Get-ChildItem -path $archPath -recurse "$(Get-RootDir)\*.dll" | ForEach-Object {
                Print-Info "Signing $($_.FullName) (waiting for 2 * 15 seconds)..."
                # Waiting for at least 15 seconds is needed because these time
                # servers usually have rate limits and signtool can fail with the
                # following error message:
                # "SignTool Error: The specified timestamp server either could not be reached or returned an invalid response.
                # src.: https://web.archive.org/web/20190306223053/https://github.com/electron-userland/electron-builder/issues/2795#issuecomment-466831315
                Start-Sleep -s 15
                signtool.exe sign /f "$(Get-RootDir)\resources\windows\certificate\mattermost-desktop-windows.pfx" /p "$env:certificate_private_key_encrypted" /tr "http://timestamp.digicert.com" /fd sha1 /td sha1 "$($_.FullName)"
                Start-Sleep -s 15
                signtool.exe sign /f "$(Get-RootDir)\resources\windows\certificate\mattermost-desktop-windows.pfx" /p "$env:certificate_private_key_encrypted" /tr "http://timestamp.digicert.com" /fd sha256 /td sha256 /as "$($_.FullName)"
            }

            Print-Info "Signing $archPath\Mattermost.exe (waiting for 2 * 15 seconds)..."
            Start-Sleep -s 15
            signtool.exe sign /f "$(Get-RootDir)\resources\windows\certificate\mattermost-desktop-windows.pfx" /p "$env:certificate_private_key_encrypted" /tr "http://timestamp.digicert.com" /fd sha1 /td sha1 "$archPath\Mattermost.exe"
            Start-Sleep -s 15
            signtool.exe sign /f "$(Get-RootDir)\resources\windows\certificate\mattermost-desktop-windows.pfx" /p "$env:certificate_private_key_encrypted" /tr "http://timestamp.digicert.com" /fd sha256 /td sha256 /as "$archPath\Mattermost.exe"
        }
    }
}

function Run-BuildLicense {

    # Convert license to RTF
    $licenseTxtFile = "$(Get-RootDir)\LICENSE.txt";
    $licenseRtfFile = "$(Get-RootDir)\resources/windows/license.rtf";
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
    heat.exe dir "$(Get-RootDir)\release\win-ia32-unpacked\" -o "$(Get-RootDir)\scripts\msi_installer_files.wxs" -scom -frag -srd -sreg -gg -cg MattermostDesktopFiles -t "$(Get-RootDir)\scripts\msi_installer_files_replace_id.xslt" -dr INSTALLDIR
    candle.exe -dPlatform=x86 "$(Get-RootDir)\scripts\msi_installer.wxs" "$(Get-RootDir)\scripts\msi_installer_files.wxs" -o "$(Get-RootDir)\scripts\"
    light.exe "$(Get-RootDir)\scripts\msi_installer.wixobj" "$(Get-RootDir)\scripts\msi_installer_files.wixobj" -loc "$(Get-RootDir)\resources\windows\msi_i18n\en_US.wxl" -o "$(Get-RootDir)\release\mattermost-desktop-$($env:MATTERMOST_BUILD_ID)-x86.msi" -b "$(Get-RootDir)\release\win-ia32-unpacked\"

    Print-Info "Building 64 bits msi installer..."
    heat.exe dir "$(Get-RootDir)\release\win-unpacked\" -o "$(Get-RootDir)\scripts\msi_installer_files.wxs" -scom -frag -srd -sreg -gg -cg MattermostDesktopFiles -t "$(Get-RootDir)\scripts\msi_installer_files_replace_id.xslt" -t "$(Get-RootDir)\scripts\msi_installer_files_set_win64.xslt" -dr INSTALLDIR
    candle.exe -dPlatform=x64 "$(Get-RootDir)\scripts\msi_installer.wxs" "$(Get-RootDir)\scripts\msi_installer_files.wxs" -o "$(Get-RootDir)\scripts\"
    light.exe "$(Get-RootDir)\scripts\msi_installer.wixobj" "$(Get-RootDir)\scripts\msi_installer_files.wixobj" -loc "$(Get-RootDir)\resources\windows\msi_i18n\en_US.wxl" -o "$(Get-RootDir)\release\mattermost-desktop-$($env:MATTERMOST_BUILD_ID)-x64.msi" -b "$(Get-RootDir)\release\win-unpacked\"

    # Only sign the executable and .dll if this is a release and not a pull request
    # check.
    if ($env:APPVEYOR_REPO_TAG) {
        Print-Info "Signing mattermost-desktop-$($env:MATTERMOST_BUILD_ID)-x86.msi (waiting for 15 seconds)..."
        Start-Sleep -s 15
        # Dual signing is not supported on msi files. Is it recommended to sign with 256 hash.
        # src.: https://security.stackexchange.com/a/124685/84134
        # src.: https://social.msdn.microsoft.com/Forums/windowsdesktop/en-us/d4b70ecd-a883-4289-8047-cc9cde28b492#0b3e3b80-6b3b-463f-ac1e-1bf0dc831952
        signtool.exe sign /f "$(Get-RootDir)\resources\windows\certificate\mattermost-desktop-windows.pfx" /p "$env:certificate_private_key_encrypted" /tr "http://timestamp.digicert.com" /fd sha256 /td sha256 "$(Get-RootDir)\release\mattermost-desktop-$($env:MATTERMOST_BUILD_ID)-x86.msi"

        Print-Info "Signing mattermost-desktop-$($env:MATTERMOST_BUILD_ID)-x64.msi (waiting for 15 seconds)..."
        Start-Sleep -s 15
        signtool.exe sign /f "$(Get-RootDir)\resources\windows\certificate\mattermost-desktop-windows.pfx" /p "$env:certificate_private_key_encrypted" /tr "http://timestamp.digicert.com" /fd sha256 /td sha256 "$(Get-RootDir)\release\mattermost-desktop-$($env:MATTERMOST_BUILD_ID)-x64.msi"
    }
}

function Run-Build {
    Check-Deps -Verbose
    Prepare-Path
    Run-BuildId
    Run-BuildChangelog
    Run-BuildElectron
    
    Run-BuildForceSignature
    Run-BuildLicense
    Run-BuildMsi
}

function Run-Test {
    Check-Deps -Verbose
    Prepare-Path
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

    try {
        switch ($makeRule.toLower()) {
            "all" {
                Install-Deps
                Run-Build
                Run-Test
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
            "debug" {
                Enable-AppVeyorRDP
            }
            default {
                Print-Error "Make file argument ""$_"" is invalid. Build process aborted."
            }
        }
    } catch {
        switch ($_.Exception.Message) {
            "makefile.deps.missing" {
                Print-Error "The following dependencies are missing: $($missing -Join ', ').`n    Please install dependencies as an administrator:`n    # makefile.ps1 install-deps"
            }
            "makefile.deps.notadmin" {
                Print-Error "Installing dependencies requires admin privileges. Operation aborted.`n    Please reexecute this makefile as an administrator:`n    # makefile.ps1 install-deps"
            }
            default {          
                Print-Error "Another error occurred: $_"
            }
        }
    }

    $env:Path = $pathBackup
}

Main
#endregion