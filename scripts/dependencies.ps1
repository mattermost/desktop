# import tools
. .\scripts\tools.ps1

# src: https://superuser.com/a/756696/456258
function Is-Admin {
    return ([Security.Principal.WindowsPrincipal] `
            [Security.Principal.WindowsIdentity]::GetCurrent() `
            ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

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
