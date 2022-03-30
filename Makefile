
ifeq ($(OS),Windows_NT)
	PLATFORM := Windows
else
	PLATFORM := $(shell uname)
endif

SIGNER?="origin"
IS_CI=${CI}
JQ=$(shell command which jq || echo "N/A")
VAULT=$(shell command which vault || echo "N/A")
GPG=$(shell command which gpg || echo "N/A")
DPKG_SIG=$(shell command which dpkg-sig || echo "N/A")

.PHONY: setup-package
setup-package: ##Configure running environment to generate package in CI
ifeq ($(IS_CI),true)
	wget -qO - https://download.opensuse.org/repositories/Emulators:/Wine:/Debian/xUbuntu_18.04/Release.key | apt-key add -
	apt-get update || true && apt-get install -y ca-certificates libxtst-dev libpng++-dev && apt-get update && apt-get -y install --no-install-recommends jq icnsutils graphicsmagick tzdata
else 
ifeq ("$(JQ)","N/A")
	@echo "Path does not contain jq executable. Consider install!" 
	@exit 10
else
	@echo "jq Found in path!"
endif
endif	
	
.PHONY: npm-ci	
npm-ci: setup-package ## Install all npm dependencies
	PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci

.PHONY: package
package: package-linux ## Generates packages for all environments

.PHONY: package-linux
package-linux: npm-ci ## Generates linux packages under build/linux folder
	$(eval VERSION := $(shell jq -r '.version' <package.json))

	npm run package:linux
	
	mkdir -p artifacts
	cp "release/${VERSION}/mattermost-desktop-*-linux-* artifacts/
	cp "release/${VERSION}/mattermost-desktop_${VERSION}-1_*.deb" artifacts/

.PHONY: check-sign-deb
check-sign-deb: ##Check running environment to sign packages in CI
ifeq ("$(GPG)","N/A")
	@echo "Path does not contain gpg executable. Consider install!" 
	@exit 11
else
	@echo "gpg Found in path!"
endif
ifeq ("$(DPKG_SIG)","N/A")
	@echo "Path does not contain dpkg_sig executable. Consider install!" 
	@exit 12
else
	@echo "dpkg_sig Found in path!"
endif
ifndef GPG_KEY_ID
	@echo "Please define GPG_KEY_ID environment variable!" 
	@exit 20
else
	@echo "GPG_KEY_ID is defined" 
endif

.PHONY: sign
sign: sign-deb ## Sign packages in artifacts directory

.PHONY: sign-deb
sign-deb: check-sign-deb ## Sign debian packages
	for file in ./artifacts/*.deb; do
		dpkg-sig -k ${GPG_KEY_ID} --sign ${SIGNER} $file
		dpkg-sig --verify $file
	done


## Help documentation à la https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
help:
	@grep -E '^[0-9a-zA-Z_-]+:.*?## .*$$' ./Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
	