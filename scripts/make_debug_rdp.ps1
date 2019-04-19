# Please uncomment to have a RDP session, particularly useful to debug
# src.: https://www.appveyor.com/docs/how-to/rdp-to-build-worker/
$blockRdp = $true; iex ((new-object net.webclient).DownloadString('https://raw.githubusercontent.com/appveyor/ci/master/scripts/enable-rdp.ps1'))