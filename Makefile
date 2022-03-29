
ifeq ($(OS),Windows_NT)
	PLATFORM := Windows
else
	PLATFORM := $(shell uname)
endif

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

.PHONY: setup-sign-deb
setup-sign-deb: ##Configure running environment to sign packages in CI
ifeq ($(IS_CI),true)
ifeq ("$(VAULT)","N/A")
	curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
	sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
	sudo apt-get update && sudo apt-get install vault
endif
	sudo apt-get update && sudo apt-get install gnupg dpkg-sig
else
ifeq ("$(VAULT)","N/A")
	@echo "Path does not contain vault executable. Consider install!" 
	@exit 11
else
	@echo "vault Found in path!"
endif
ifeq ("$(GPG)","N/A")
	@echo "Path does not contain gpg executable. Consider install!" 
	@exit 12
else
	@echo "gpg Found in path!"
endif
ifeq ("$(DPKG_SIG)","N/A")
	@echo "Path does not contain dpkg_sig executable. Consider install!" 
	@exit 13
else
	@echo "dpkg_sig Found in path!"
endif
endif

.PHONY: sign
sign: sign-deb ## Sign packages in artifacts directory

.PHONY: sign-deb
sign-deb: setup-sign-deb ## Sign debian packages
	$(eval VERSION := $(shell jq -r '.version' <package.json))
	vault kv get -field=signing_key secret/omnibus/production | gpg --batch --import
	gpg --list-secret-keys --keyid-format LONG

## Help documentation à la https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
help:
	@grep -E '^[0-9a-zA-Z_-]+:.*?## .*$$' ./Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
	