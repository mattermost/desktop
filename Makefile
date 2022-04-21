SIGNER?="origin"

GPG=$(shell command which gpg || echo "N/A")
DPKG_SIG=$(shell command which dpkg-sig || echo "N/A")

define sign_debian_package
	dpkg-sig -k ${GPG_KEY_ID} --sign ${SIGNER} $1
	dpkg-sig --verify $1	
endef

.PHONY: check-sign-linux-deb
check-sign-linux-deb: ##Check running environment to sign debian packages
ifeq ("$(GPG)","N/A")
	@echo "Path does not contain gpg executable. Consider install!" 
	@exit 128
else
	@echo "gpg Found in path!"
endif
ifeq ("$(DPKG_SIG)","N/A")
	@echo "Path does not contain dpkg_sig executable. Consider install!" 
	@exit 128
else
	@echo "dpkg_sig Found in path!"
endif
ifndef GPG_KEY_ID
	@echo "Please define GPG_KEY_ID environment variable!" 
	@exit 128
else
	@echo "GPG_KEY_ID is defined" 
endif

.PHONY: npm-ci	
npm-ci: ## Install all npm dependencies
	PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci

.PHONY: package
package: package-linux-deb ## Generates packages for all environments

.PHONY: package-linux-deb
package-linux-deb: npm-ci ## Generates linux packages under build/linux folder
	npm run package:linux-deb
	mkdir -p artifacts
	find ./release -name '*.deb' -exec cp "{}" artifacts/  \;


.PHONY: sign
sign: sign-linux-deb ## Sign packages in artifacts directory

.PHONY: sign-linux-deb
sign-linux-deb: check-sign-linux-deb ## Sign debian packages
	$(foreach file, $(wildcard artifacts/*.deb), $(call sign_debian_package,${file});)

## Help documentation à la https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
help:
	@grep -E '^[0-9a-zA-Z_-]+:.*?## .*$$' ./Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

