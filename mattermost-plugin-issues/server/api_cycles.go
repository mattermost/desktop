// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

func (p *Plugin) handleListCycles(w http.ResponseWriter, r *http.Request) {
	projectID := mux.Vars(r)["id"]
	cycles, err := p.store.ListCycles(projectID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, cycles)
}

func (p *Plugin) handleCreateCycle(w http.ResponseWriter, r *http.Request) {
	projectID := mux.Vars(r)["id"]

	var req CreateCycleRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	cycle := &Cycle{
		ID:        uuid.New().String(),
		ProjectID: projectID,
		Name:      req.Name,
		StartDate: req.StartDate,
		EndDate:   req.EndDate,
		IsActive:  false,
	}

	if err := cycle.IsValid(); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := p.store.CreateCycle(cycle); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	p.broadcastCycle(wsEventCycleCreated, cycle)
	respondJSON(w, http.StatusCreated, cycle)
}

func (p *Plugin) handleUpdateCycle(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	cycle, err := p.store.GetCycle(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}

	var req UpdateCycleRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name != nil {
		cycle.Name = *req.Name
	}
	if req.StartDate != nil {
		cycle.StartDate = *req.StartDate
	}
	if req.EndDate != nil {
		cycle.EndDate = *req.EndDate
	}
	if req.IsActive != nil {
		cycle.IsActive = *req.IsActive
	}

	if err := cycle.IsValid(); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := p.store.UpdateCycle(cycle); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	p.broadcastCycle(wsEventCycleUpdated, cycle)
	respondJSON(w, http.StatusOK, cycle)
}

func (p *Plugin) handleDeleteCycle(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	if _, err := p.store.GetCycle(id); err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}

	if err := p.store.DeleteCycle(id); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	p.broadcastDelete(wsEventCycleDeleted, id)
	w.WriteHeader(http.StatusNoContent)
}
