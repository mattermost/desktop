.PHONY: npm-ci package package-linux setup-env

ifeq ($(OS),Windows_NT)
	PLATFORM := Windows
else
	PLATFORM := $(shell uname)
endif

IS_CI=${CI}

setup-env: #Configure running environment
ifeq ($(IS_CI),true)
	wget -qO - https://download.opensuse.org/repositories/Emulators:/Wine:/Debian/xUbuntu_18.04/Release.key | apt-key add -
    apt-get update || true && apt-get install -y ca-certificates libxtst-dev libpng++-dev && apt-get update && apt-get -y install --no-install-recommends jq icnsutils graphicsmagick tzdata
    wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/download/v4.20.1/yq_linux_amd64 && chmod a+x /usr/local/bin/yq
    mkdir -p ~/.ssh && ssh-keyscan -t rsa github.com > ~/.ssh/known_hosts
    echo "${SSH_KEY}" > ~/.ssh/id_rsa && chmod 600 ~/.ssh/id_rsa
    eval `ssh-agent -s`
    ssh-add ~/.ssh/id_rsa
endif

npm-ci: setup-env # Install all npm dependencies
	PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci
    
package: package-linux # Generates packages

package-linux: npm-ci # Generates linux packages under build/linux folder
	npm run package:linux
	scripts/patch_updater_yml.sh
	scripts/cp_artifacts.sh release build/linux
	ls -laR build/linux

## Help documentation à la https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
help:
	@grep -E '^[0-9a-zA-Z_-]+:.*?## .*$$' ./Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
	