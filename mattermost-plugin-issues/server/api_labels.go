// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

func (p *Plugin) handleListLabels(w http.ResponseWriter, r *http.Request) {
	projectID := mux.Vars(r)["id"]
	labels, err := p.store.ListLabels(projectID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, labels)
}

func (p *Plugin) handleCreateLabel(w http.ResponseWriter, r *http.Request) {
	projectID := mux.Vars(r)["id"]

	var req CreateLabelRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	label := &IssueLabel{
		ID:        uuid.New().String(),
		ProjectID: projectID,
		Name:      req.Name,
		Color:     req.Color,
	}

	if err := label.IsValid(); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := p.store.CreateLabel(label); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	p.broadcastLabel(wsEventLabelCreated, label)
	respondJSON(w, http.StatusCreated, label)
}

func (p *Plugin) handleUpdateLabel(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	label, err := p.store.GetLabel(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}

	var req UpdateLabelRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name != nil {
		label.Name = *req.Name
	}
	if req.Color != nil {
		label.Color = *req.Color
	}

	if err := label.IsValid(); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := p.store.UpdateLabel(label); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	p.broadcastLabel(wsEventLabelUpdated, label)
	respondJSON(w, http.StatusOK, label)
}

func (p *Plugin) handleDeleteLabel(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	if _, err := p.store.GetLabel(id); err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}

	if err := p.store.DeleteLabel(id); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	p.broadcastDelete(wsEventLabelDeleted, id)
	w.WriteHeader(http.StatusNoContent)
}
