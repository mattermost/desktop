.PHONY: npm-ci package package-linux setup-env version

ifeq ($(OS),Windows_NT)
	PLATFORM := Windows
else
	PLATFORM := $(shell uname)
endif

IS_CI=${CI}
VERSION:=$(shell jq -r '.version' <package.json)

version: ##Gets version 
	@jq -r .version ./package.json

setup-env: ##Configure running environment
ifeq ($(IS_CI),true)
	wget -qO - https://download.opensuse.org/repositories/Emulators:/Wine:/Debian/xUbuntu_18.04/Release.key | apt-key add -
	apt-get update || true && apt-get install -y ca-certificates libxtst-dev libpng++-dev && apt-get update && apt-get -y install --no-install-recommends jq icnsutils graphicsmagick tzdata
	wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/download/v4.20.1/yq_linux_amd64 && chmod a+x /usr/local/bin/yq
else
	@printf "Local Environment Setup"

endif

npm-ci: setup-env ## Install all npm dependencies
	PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci

package: package-linux ## Generates packages for all environments

package-linux: npm-ci ## Generates linux packages under build/linux folder
	npm run package:linux
	scripts/patch_updater_yml.sh
	scripts/cp_artifacts.sh release build/linux
	ls -laR build/linux
ifeq ($(IS_CI),true)
	mkdir -p artifacts
	mv build/linux/$VERSION/*.deb artifacts/
	mv build/linux/$VERSION/*.rpm artifacts/ 
endif

## Help documentation à la https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
help:
	@grep -E '^[0-9a-zA-Z_-]+:.*?## .*$$' ./Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
	