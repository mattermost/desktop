// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

func (p *Plugin) handleListProjects(w http.ResponseWriter, _ *http.Request) {
	projects, err := p.store.ListProjects()
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, projects)
}

func (p *Plugin) handleCreateProject(w http.ResponseWriter, r *http.Request) {
	var req CreateProjectRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	project := &Project{
		ID:              uuid.New().String(),
		Name:            req.Name,
		Prefix:          normalizePrefix(req.Prefix),
		NextIssueNumber: 0,
		CreatedBy:       getUserID(r),
		CreatedAt:       nowMillis(),
	}

	if err := project.IsValid(); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := p.store.CreateProject(project); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, project)
}

func (p *Plugin) handleGetProject(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	project, err := p.store.GetProject(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, project)
}

func (p *Plugin) handleUpdateProject(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	project, err := p.store.GetProject(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}

	var req CreateProjectRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name != "" {
		project.Name = req.Name
	}
	if req.Prefix != "" {
		project.Prefix = normalizePrefix(req.Prefix)
	}

	if err := project.IsValid(); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := p.store.UpdateProject(project); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, project)
}

func (p *Plugin) handleDeleteProject(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	if _, err := p.store.GetProject(id); err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}

	if err := p.store.DeleteProject(id); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
