PLUGIN_ID ?= com.mattermost.issues
PLUGIN_VERSION ?= 0.1.0
BUNDLE_NAME ?= $(PLUGIN_ID)-$(PLUGIN_VERSION).tar.gz

GO ?= $(shell command -v go 2>/dev/null)
NPM ?= $(shell command -v npm 2>/dev/null)

MM_SERVICESETTINGS_SITEURL ?= http://localhost:8065
MM_ADMIN_TOKEN ?=

GO_BUILD_FLAGS ?= -trimpath -ldflags '-s -w'

SERVER_OUT = server/dist
WEBAPP_OUT = webapp/dist

.PHONY: all server webapp bundle dist deploy clean test check

all: dist

server:
	@echo "Building server..."
	@mkdir -p $(SERVER_OUT)
	env GOOS=linux GOARCH=amd64 $(GO) build $(GO_BUILD_FLAGS) -o $(SERVER_OUT)/plugin-linux-amd64 ./server
	env GOOS=linux GOARCH=arm64 $(GO) build $(GO_BUILD_FLAGS) -o $(SERVER_OUT)/plugin-linux-arm64 ./server
	env GOOS=darwin GOARCH=amd64 $(GO) build $(GO_BUILD_FLAGS) -o $(SERVER_OUT)/plugin-darwin-amd64 ./server
	env GOOS=darwin GOARCH=arm64 $(GO) build $(GO_BUILD_FLAGS) -o $(SERVER_OUT)/plugin-darwin-arm64 ./server
	env GOOS=windows GOARCH=amd64 $(GO) build $(GO_BUILD_FLAGS) -o $(SERVER_OUT)/plugin-windows-amd64.exe ./server

webapp:
	@echo "Building webapp..."
	cd webapp && $(NPM) install --legacy-peer-deps && $(NPM) run build

bundle: server webapp
	@echo "Bundling plugin..."
	@rm -rf dist
	@mkdir -p dist
	@cp plugin.json dist/
	@cp -r assets dist/
	@mkdir -p dist/server/dist
	@cp -r $(SERVER_OUT)/* dist/server/dist/
	@mkdir -p dist/webapp/dist
	@cp $(WEBAPP_OUT)/main.js dist/webapp/dist/
	cd dist && tar -czf ../$(BUNDLE_NAME) .
	@echo "Plugin bundle created: $(BUNDLE_NAME)"

dist: bundle

deploy: dist
ifndef MM_ADMIN_TOKEN
	$(error MM_ADMIN_TOKEN is not set. Get one from System Console > Integrations > Bot Accounts or use a personal access token)
endif
	@echo "Deploying to $(MM_SERVICESETTINGS_SITEURL)..."
	curl -s -X POST $(MM_SERVICESETTINGS_SITEURL)/api/v4/plugins \
		-H "Authorization: Bearer $(MM_ADMIN_TOKEN)" \
		-F "plugin=@$(BUNDLE_NAME)" \
		-F "force=true"
	curl -s -X POST $(MM_SERVICESETTINGS_SITEURL)/api/v4/plugins/$(PLUGIN_ID)/enable \
		-H "Authorization: Bearer $(MM_ADMIN_TOKEN)"
	@echo "\nPlugin deployed and enabled."

test:
	@echo "Running server tests..."
	cd server && $(GO) test ./... -v -count=1
	@echo "Running webapp tests..."
	cd webapp && $(NPM) test -- --passWithNoTests

check:
	@echo "Running checks..."
	cd server && $(GO) vet ./...

clean:
	rm -rf dist $(SERVER_OUT) $(WEBAPP_OUT) $(BUNDLE_NAME)
	rm -rf webapp/node_modules
