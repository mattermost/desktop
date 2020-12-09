# Electron's version.
$env:npm_config_target=(jq ".config.npm_config_target" .\package.json)
# The architecture of Electron, see https://electronjs.org/docs/tutorial/support#supported-platforms
# for supported architectures.
$env:npm_config_arch='x64'
$env:npm_config_target_arch='x64'
# Download headers for Electron.
$env:npm_config_disturl='https://electronjs.org/headers'
# Tell node-pre-gyp that we are building for Electron.
$env:npm_config_runtime='electron'
# Tell node-pre-gyp to build module from source code.
$env:npm_config_build_from_source=1
