// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
)

func (p *Plugin) initRouter() *mux.Router {
	router := mux.NewRouter()

	// User-facing API (Mattermost session auth).
	api := router.PathPrefix("/api/v1").Subrouter()
	api.Use(p.authMiddleware)

	// Projects
	api.HandleFunc("/projects", p.handleListProjects).Methods(http.MethodGet)
	api.HandleFunc("/projects", p.handleCreateProject).Methods(http.MethodPost)
	api.HandleFunc("/projects/{id}", p.handleGetProject).Methods(http.MethodGet)
	api.HandleFunc("/projects/{id}", p.handleUpdateProject).Methods(http.MethodPut)
	api.HandleFunc("/projects/{id}", p.handleDeleteProject).Methods(http.MethodDelete)

	// Issues
	api.HandleFunc("/projects/{id}/issues", p.handleListIssues).Methods(http.MethodGet)
	api.HandleFunc("/projects/{id}/issues", p.handleCreateIssue).Methods(http.MethodPost)
	api.HandleFunc("/issues/{id}", p.handleGetIssue).Methods(http.MethodGet)
	api.HandleFunc("/issues/{id}", p.handleUpdateIssue).Methods(http.MethodPut)
	api.HandleFunc("/issues/{id}", p.handleDeleteIssue).Methods(http.MethodDelete)

	// Labels
	api.HandleFunc("/projects/{id}/labels", p.handleListLabels).Methods(http.MethodGet)
	api.HandleFunc("/projects/{id}/labels", p.handleCreateLabel).Methods(http.MethodPost)
	api.HandleFunc("/labels/{id}", p.handleUpdateLabel).Methods(http.MethodPut)
	api.HandleFunc("/labels/{id}", p.handleDeleteLabel).Methods(http.MethodDelete)

	// Cycles
	api.HandleFunc("/projects/{id}/cycles", p.handleListCycles).Methods(http.MethodGet)
	api.HandleFunc("/projects/{id}/cycles", p.handleCreateCycle).Methods(http.MethodPost)
	api.HandleFunc("/cycles/{id}", p.handleUpdateCycle).Methods(http.MethodPut)
	api.HandleFunc("/cycles/{id}", p.handleDeleteCycle).Methods(http.MethodDelete)

	// Context (aggregated read-only views for agents)
	api.HandleFunc("/context/general", p.handleGetGeneralContext).Methods(http.MethodGet)
	api.HandleFunc("/projects/{id}/context", p.handleGetProjectContext).Methods(http.MethodGet)
	api.HandleFunc("/issues/{id}/context", p.handleGetIssueContext).Methods(http.MethodGet)

	// Internal API for AI service callbacks (shared-secret auth).
	internal := router.PathPrefix("/internal").Subrouter()
	internal.Use(p.internalAuthMiddleware)

	internal.HandleFunc("/projects", p.handleInternalListProjects).Methods(http.MethodGet)
	internal.HandleFunc("/projects/{id}/issues", p.handleInternalListIssues).Methods(http.MethodGet)
	internal.HandleFunc("/projects/{id}/issues", p.handleInternalCreateIssue).Methods(http.MethodPost)
	internal.HandleFunc("/issues/{id}", p.handleInternalGetIssue).Methods(http.MethodGet)
	internal.HandleFunc("/issues/{id}", p.handleInternalUpdateIssue).Methods(http.MethodPut)
	internal.HandleFunc("/issues/{id}", p.handleInternalDeleteIssue).Methods(http.MethodDelete)
	internal.HandleFunc("/projects/{id}/labels", p.handleInternalListLabels).Methods(http.MethodGet)
	internal.HandleFunc("/projects/{id}/cycles", p.handleInternalListCycles).Methods(http.MethodGet)
	internal.HandleFunc("/channels/{id}/history", p.handleInternalGetChannelHistory).Methods(http.MethodGet)

	return router
}

// authMiddleware ensures the request comes from an authenticated Mattermost user.
func (p *Plugin) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("Mattermost-User-ID")
		if userID == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func getUserID(r *http.Request) string {
	return r.Header.Get("Mattermost-User-ID")
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data) //nolint:errcheck
	}
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respondJSON(w, status, map[string]string{"error": msg})
}

func decodeJSON(r *http.Request, v interface{}) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}
