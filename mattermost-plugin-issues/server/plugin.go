// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"net/http"
	"sync"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// Plugin implements the Mattermost plugin interface.
type Plugin struct {
	plugin.MattermostPlugin

	configLock sync.RWMutex
	router     *mux.Router
	store      Store
}

// OnActivate is called when the plugin is activated.
func (p *Plugin) OnActivate() error {
	p.store = NewKVStore(p.API)
	p.router = p.initRouter()

	if err := p.API.RegisterCommand(getCommand()); err != nil {
		return err
	}

	return nil
}

// ServeHTTP routes incoming HTTP requests to the plugin's REST API.
func (p *Plugin) ServeHTTP(_ *plugin.Context, w http.ResponseWriter, r *http.Request) {
	p.router.ServeHTTP(w, r)
}
