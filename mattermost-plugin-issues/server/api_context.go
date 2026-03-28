// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"net/http"

	"github.com/gorilla/mux"
)

// ProjectContext is a project with all its issues, labels, and cycles.
type ProjectContext struct {
	Project *Project      `json:"project"`
	Issues  []*Issue      `json:"issues"`
	Labels  []*IssueLabel `json:"labels"`
	Cycles  []*Cycle      `json:"cycles"`
}

// GeneralContext is the full state: all projects with their data.
type GeneralContext struct {
	Projects []ProjectContext `json:"projects"`
}

// IssueContext is an issue enriched with resolved label, assignee, and cycle info.
type IssueContext struct {
	Issue        *Issue        `json:"issue"`
	Labels       []*IssueLabel `json:"labels"`
	AssigneeName string        `json:"assignee_name,omitempty"`
	CycleName    string        `json:"cycle_name,omitempty"`
}

// GET /api/v1/context/general
func (p *Plugin) handleGetGeneralContext(w http.ResponseWriter, _ *http.Request) {
	projects, err := p.store.ListProjects()
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	result := GeneralContext{
		Projects: make([]ProjectContext, 0, len(projects)),
	}

	for _, project := range projects {
		issues, err := p.store.ListIssues(project.ID, IssueFilterParams{})
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		labels, err := p.store.ListLabels(project.ID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		cycles, err := p.store.ListCycles(project.ID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		result.Projects = append(result.Projects, ProjectContext{
			Project: project,
			Issues:  issues,
			Labels:  labels,
			Cycles:  cycles,
		})
	}

	respondJSON(w, http.StatusOK, result)
}

// GET /api/v1/projects/{id}/context
func (p *Plugin) handleGetProjectContext(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	project, err := p.store.GetProject(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}

	issues, err := p.store.ListIssues(id, IssueFilterParams{})
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	labels, err := p.store.ListLabels(id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	cycles, err := p.store.ListCycles(id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, ProjectContext{
		Project: project,
		Issues:  issues,
		Labels:  labels,
		Cycles:  cycles,
	})
}

// GET /api/v1/issues/{id}/context
func (p *Plugin) handleGetIssueContext(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	issue, err := p.store.GetIssue(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}

	// Resolve labels
	labels := make([]*IssueLabel, 0, len(issue.LabelIDs))
	for _, labelID := range issue.LabelIDs {
		if label, err := p.store.GetLabel(labelID); err == nil {
			labels = append(labels, label)
		}
	}

	// Resolve assignee name
	var assigneeName string
	if issue.AssigneeID != "" {
		if user, appErr := p.API.GetUser(issue.AssigneeID); appErr == nil {
			assigneeName = user.Username
		}
	}

	// Resolve cycle name
	var cycleName string
	if issue.CycleID != "" {
		if cycle, err := p.store.GetCycle(issue.CycleID); err == nil {
			cycleName = cycle.Name
		}
	}

	respondJSON(w, http.StatusOK, IssueContext{
		Issue:        issue,
		Labels:       labels,
		AssigneeName: assigneeName,
		CycleName:    cycleName,
	})
}
