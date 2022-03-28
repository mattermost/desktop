.PHONY: package package-linux

package: package-linux # Generates packages

package-linux: # Generates linux packages under build/linux folder
	npm run package:linux
	scripts/patch_updater_yml.sh
	scripts/cp_artifacts.sh release build/linux

## Help documentation à la https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
help:
	@grep -E '^[0-9a-zA-Z_-]+:.*?## .*$$' ./Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
	