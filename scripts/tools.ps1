################################################################################
# Logging functions
################################################################################
#region
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
# endregion

################################################################################
# OS related functions
################################################################################
# region

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
# endregion

################################################################################
# finding tools related functions
################################################################################
# region
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

# endregion

