# We would have preferred to put this main section to the end of the file,
# but script arguments must be defined as the first statement in a PowerShell
# script.
Param (
    [parameter(Position=0)]$makeRule
)

# While the different sections of this file may be better with import statements
# or even better with PowerShell modules, choosing this option would require
# them to be installed on CircleCI servers, which also breaks selfcontainement
# of this makefile.

################################################################################
# Logging functions
################################################################################
#Region
function Print {
    Param (
       [String]$message,
       [Switch]$NoNewLine
   )
   if ($NoNewLine) {
       Write-Host " $message" -NoNewLine
   } else {
       Write-Host " $message"
   }
}

function Print-Info {
   Param (
       [String]$message,
       [Switch]$NoNewLine
   )
   if ([String]::IsNullOrEmpty($message)) {
       return
   }

   Write-Host "[" -NoNewLine
   Write-Host "+" -NoNewLine -ForegroundColor Green
   Write-Host "]" -NoNewLine

   if ($NoNewLine) {
       Write-Host " $message" -NoNewLine
   } else {
       Write-Host " $message"
   }
}

function Print-Warning {
   Param (
       [String]$message,
       [Switch]$NoNewLine
   )
   if ([String]::IsNullOrEmpty($message)) {
       return
   }

   Write-Host "[" -NoNewLine
   Write-Host "!" -NoNewLine -ForegroundColor Magenta
   Write-Host "]" -NoNewLine

   if ($NoNewLine) {
       Write-Host " $message" -NoNewLine
   } else {
       Write-Host " $message"
   }
}

# Avoid stacktrace to be displayed along side the error message.
# We want things simplistic.
# src.: https://stackoverflow.com/q/38064704/3514658
# src.: https://stackoverflow.com/a/38064769
# We won't use [Console]::*Write* not $host.ui.Write* statements
# as they are UI items
# src.: https://web.archive.org/web/20190720224207/https://docs.microsoft.com/en-us/powershell/developer/cmdlet/types-of-cmdlet-output
# Rewriting the error printing function in C# and calling it from Posh is not
# working either because the redirection to stderr doesn't work under Posh but
# is working when the Posh script is run from cmd.exe. We are giving up here
# and simply using Write-Host without stderr redirection.
function Print-Error {
   Param (
       [String]$message,
       [Switch]$NoNewLine
   )
   if ([String]::IsNullOrEmpty($message)) {
       return
   }

   Write-Host "[" -NoNewLine
   Write-Host "-" -NoNewLine -ForegroundColor Red
   Write-Host "]" -NoNewLine

   if ($NoNewLine) {
       Write-Host " $message" -NoNewLine
   } else {
       Write-Host " $message"
   }
}
#EndRegion

################################################################################
# OS related functions
################################################################################
#Region
function Check-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

function Refresh-Path {
    $env:Path =
        [System.Environment]::GetEnvironmentVariable("Path", "Machine") +
        ";" +
        [System.Environment]::GetEnvironmentVariable("Path", "User")
}

function Get-RootDir {
    return "$(Split-Path $PSCommandPath)\..\"
}

# src: https://superuser.com/a/756696/456258
function Is-Admin {
    return ([Security.Principal.WindowsPrincipal] `
            [Security.Principal.WindowsIdentity]::GetCurrent() `
            ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
#EndRegion

################################################################################
# Check and install of dependencies related functions
################################################################################
#Region
function Check-Deps {
    Param (
        [Switch]
        $verbose,
        [Switch]
        $throwable
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
    if ($verbose) { Print-Info "Checking jq dependency..." }
    if (!(Check-Command "jq")) {
        if ($verbose) { Print-Error "jq dependency missing." }
        $missing += "jq"
    }

    if ($throwable -and $missing.Count -gt 0) {
        throw "com.mattermost.makefile.deps.missing"
    }

    return $missing
}

function Install-Deps {
    [array]$missing = Check-Deps -Verbose

    if ($missing -eq $null) {
        Print-Info "All dependencies met; exiting dependencies installation..."
        return
    }

    if (-not (Is-Admin)) {
        throw "com.mattermost.makefile.deps.notadmin"
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
                Install-Wix
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
            "jq" {
                Print-Info "Installing jq"
                choco install jq --yes
                break;
            }
        }

        Print-Info "Refreshing PATH..."
        Refresh-Path
    }
}

function Install-Wix {
    Print-Info "Downloading wixtoolset..."
    # choco is using 3.11 which causes problems building on remote ssh due to dotnet3.5
    # choco install wixtoolset --yes
    $WebClient = New-Object System.Net.WebClient
    # if they ever fix the installer we can move to 3.11
    #$WebClient.DownloadFile("https://github.com/wixtoolset/wix3/releases/download/wix3111rtm/wix311.exe",".\scripts\wix.exe")
    $WebClient.DownloadFile("https://github.com/wixtoolset/wix3/releases/download/wix3104rtm/wix310.exe",".\scripts\wix.exe")
    Print-Info "Installing wixtoolset..."
    # todo: check hash
    .\scripts\wix.exe -q
    if ($LastExitCode -ne $null) {
        throw "com.mattermost.makefile.deps.wix"
    }
    Print-Info "wixtoolset installed!"
}
#EndRegion

################################################################################
# Research of dependencies related functions
################################################################################
#Region
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
    $progFile = ${env:ProgramW6432}
    $npmDir = Join-Path -Path "$progFile" -ChildPath "nodejs"
    if ([System.IO.File]::Exists("$npmDir\npm.cmd")) {
        return $npmDir
    }
    return $null
}
#EndRegion

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
    $currentTag = [string]"HEAD"
    $changelogRaw = "$(git log --oneline --since=""$(git log -1 ""$previousTag"" --pretty=%ad)"" --until=""$(git log -1 "$currentTag" --pretty=%ad)"")"
    $changelog = "";
    foreach ($i in $changelogRaw) {
        $changelog += "* $i`n"
    }
    $env:COM_MATTERMOST_MAKEFILE_BUILD_CHANGELOG = $changelog
}

function Run-BuildElectron {
    Print-Info "Installing nodejs/electron dependencies (running npm ci)..."
    npm i -g node-gyp
    node-gyp install
    npm ci
    #npm install --prefix="$(Get-RootDir)" "$(Get-RootDir)"
    Print-Info "Building nodejs/electron code (running npm run build)..."
    npm run build
    #npm run build --prefix="$(Get-RootDir)" "$(Get-RootDir)"
    Print-Info "Packaging nodejs/electron for Windows (running npm run package:windows)..."
    # NSIS has the upgrade flag enabled, so it must be done first
    npm run package:windows-nsis
    npm run package:windows
    #npm run package:windows --prefix="$(Get-RootDir)" "$(Get-RootDir)"
}

function Run-BuildForceSignature {
    # Only sign the executable and .dll if this is a release and not a pull request
    # check.
    if (Test-Path 'env:PFX') {
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
        Print-Info "Certificate file not found, DLLs and executable won't be signed."
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
    light.exe "scripts\msi_installer.wixobj" "scripts\msi_installer_files.wixobj" -loc "resources\windows\msi_i18n\en_US.wxl" -o "release\$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)\mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x86.msi" -b "release\win-ia32-unpacked\"

    Print-Info "Building 64 bits msi installer..."
    heat.exe dir "release\win-unpacked\" -o "scripts\msi_installer_files.wxs" -scom -frag -srd -sreg -gg -cg MattermostDesktopFiles -t "scripts\msi_installer_files_replace_id.xslt" -t "scripts\msi_installer_files_set_win64.xslt" -dr INSTALLDIR
    candle.exe -dPlatform=x64 "scripts\msi_installer.wxs" "scripts\msi_installer_files.wxs" -o "scripts\"
    light.exe "scripts\msi_installer.wixobj" "scripts\msi_installer_files.wixobj" -loc "resources\windows\msi_i18n\en_US.wxl" -o "release\$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)\mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x64.msi" -b "release\win-unpacked\"

    # Only sign the executable and .dll if this is a release and not a pull request
    # check.
    if (Test-Path 'env:PFX') {
        Print-Info "Signing mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x86.msi (waiting for 15 seconds)..."
        Start-Sleep -s 15
        # Dual signing is not supported on msi files. Is it recommended to sign with 256 hash.
        # src.: https://security.stackexchange.com/a/124685/84134
        # src.: https://social.msdn.microsoft.com/Forums/windowsdesktop/en-us/d4b70ecd-a883-4289-8047-cc9cde28b492#0b3e3b80-6b3b-463f-ac1e-1bf0dc831952
        signtool.exe sign /f "./mattermost-desktop-windows.pfx" /p "$env:PFX_KEY" /tr "http://timestamp.digicert.com" /fd sha256 /td sha256 /d "release\$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)\mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x86.msi" "release\$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)\mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x86.msi"

        Print-Info "Signing mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x64.msi (waiting for 15 seconds)..."
        Start-Sleep -s 15
        signtool.exe sign /f "./mattermost-desktop-windows.pfx" /p "$env:PFX_KEY" /tr "http://timestamp.digicert.com" /fd sha256 /td sha256 /d "release\$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)\mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x64.msi" "release\$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)\mattermost-desktop-$($env:COM_MATTERMOST_MAKEFILE_BUILD_ID)-x64.msi"
    } else {
        Print-Info "Certificate file not found, the msi installers won't be signed."
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
        Print-Warning "No env:PFX environment variable found, build will not be signed."
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
#EndRegion

################################################################################
# Main function
################################################################################
#Region
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
                Install-Deps
                Run-Build
            }
            "test" {
                Install-Deps
                Run-Test
            }
            "install-deps" {
                Install-Deps
            }
            "optimize" {
                Optimize-Build
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
        $exitCode = 0

    } catch {
        switch ($_.Exception.Message) {
            "com.mattermost.makefile.deps.missing" {
                Print-Error "The following dependencies are missing: $($missing -Join ', ').`n    Please install dependencies as an administrator:`n    # makefile.ps1 install-deps"
                $exitCode = -1
            }
            "com.mattermost.makefile.deps.notadmin" {
                Print-Error "Installing dependencies requires admin privileges. Operation aborted.`n    Please reexecute this makefile as an administrator:`n    # makefile.ps1 install-deps"
                $exitCode = -2
            }
            "com.mattermost.makefile.deps.wix" {
                Print-Error "There was nothing wrong with your source code,but we found a problem installing wix toolset and couldn't continue. please try re-running the job."
                $exitCode = -3
            }   
            default {          
                Print-Error "Another error occurred: $_"
                $exitCode = -100
            }
        }
    } finally {
        if (!($env:COM_MATTERMOST_MAKEFILE_EXECUTION_SUCCESS)) {
            Print-Warning "Makefile interrupted by Ctrl + C or by another interruption handler."
        }
        Restore-ComputerState
        exit $exitCode
    }
}

Main
#EndRegion