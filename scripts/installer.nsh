# This macro fetches the currently install MM version via MSI (if any) and uninstalls it first
!macro customInit
  nsExec::ExecToStack "$\"powershell.exe$\" -command $\"$$Installer = New-Object -ComObject WindowsInstaller.Installer; $$MMProduct = $$Installer.ProductsEx('', '', 7) | Where-Object -FilterScript {$$_.InstallProperty('ProductName') -eq 'Mattermost'}; if ($$MMProduct -ne $$null) {Write-Host -NoNewline $$MMProduct.ProductCode()}$\""
  Pop $0
  Pop $1
  StrCmp $1 "" 0 +1
  ExecWait '"msiexec.exe" /x $1 /qn'
!macroend