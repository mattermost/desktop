// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"net/http"
	"sort"
	"strconv"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// internalAuthMiddleware authenticates requests from the AI service using
// a shared secret sent in the X-Internal-Secret header.
func (p *Plugin) internalAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		secret := r.Header.Get("X-Internal-Secret")

		p.configLock.RLock()
		expected := p.config.AIServiceSecret
		p.configLock.RUnlock()

		if secret == "" || secret != expected {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- Internal handlers (reuse store, attribute to bot) ---

func (p *Plugin) handleInternalListProjects(w http.ResponseWriter, _ *http.Request) {
	projects, err := p.store.ListProjects()
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, projects)
}

func (p *Plugin) handleInternalListIssues(w http.ResponseWriter, r *http.Request) {
	projectID := mux.Vars(r)["id"]
	q := r.URL.Query()

	params := IssueFilterParams{
		Status:      q.Get("status"),
		Priority:    q.Get("priority"),
		AssigneeID:  q.Get("assignee_id"),
		CycleID:     q.Get("cycle_id"),
		SearchQuery: q.Get("q"),
	}

	issues, err := p.store.ListIssues(projectID, params)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, IssueListResponse{
		Issues:     issues,
		TotalCount: len(issues),
	})
}

func (p *Plugin) handleInternalGetIssue(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	issue, err := p.store.GetIssue(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, issue)
}

func (p *Plugin) handleInternalCreateIssue(w http.ResponseWriter, r *http.Request) {
	projectID := mux.Vars(r)["id"]

	var req CreateIssueRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	now := nowMillis()
	status := req.Status
	if status == "" {
		status = IssueStatusBacklog
	}
	priority := req.Priority
	if priority == "" {
		priority = IssuePriorityNone
	}
	labelIDs := req.LabelIDs
	if labelIDs == nil {
		labelIDs = []string{}
	}

	issue := &Issue{
		ID:            uuid.New().String(),
		ProjectID:     projectID,
		Title:         req.Title,
		Description:   req.Description,
		Status:        status,
		Priority:      priority,
		LabelIDs:      labelIDs,
		AssigneeID:    req.AssigneeID,
		CycleID:       req.CycleID,
		EstimateHours: req.EstimateHours,
		CreatedBy:     p.botUserID,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := issue.IsValid(); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	created, err := p.store.CreateIssue(issue)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	p.broadcastIssue(wsEventIssueCreated, created)
	respondJSON(w, http.StatusCreated, created)
}

func (p *Plugin) handleInternalUpdateIssue(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	issue, err := p.store.GetIssue(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}

	var req UpdateIssueRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Title != nil {
		issue.Title = *req.Title
	}
	if req.Description != nil {
		issue.Description = *req.Description
	}
	if req.Status != nil {
		oldStatus := issue.Status
		issue.Status = *req.Status
		if !oldStatus.IsCompleted() && issue.Status.IsCompleted() {
			issue.CompletedAt = nowMillis()
		} else if oldStatus.IsCompleted() && !issue.Status.IsCompleted() {
			issue.CompletedAt = 0
		}
	}
	if req.Priority != nil {
		issue.Priority = *req.Priority
	}
	if req.LabelIDs != nil {
		issue.LabelIDs = req.LabelIDs
	}
	if req.AssigneeID != nil {
		issue.AssigneeID = *req.AssigneeID
	}
	if req.CycleID != nil {
		issue.CycleID = *req.CycleID
	}
	if req.EstimateHours != nil {
		issue.EstimateHours = *req.EstimateHours
	}
	if req.SortOrder != nil {
		issue.SortOrder = *req.SortOrder
	}

	issue.UpdatedAt = nowMillis()

	if err := issue.IsValid(); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := p.store.UpdateIssue(issue); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	p.broadcastIssue(wsEventIssueUpdated, issue)
	respondJSON(w, http.StatusOK, issue)
}

func (p *Plugin) handleInternalListLabels(w http.ResponseWriter, r *http.Request) {
	projectID := mux.Vars(r)["id"]
	labels, err := p.store.ListLabels(projectID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, labels)
}

func (p *Plugin) handleInternalListCycles(w http.ResponseWriter, r *http.Request) {
	projectID := mux.Vars(r)["id"]
	cycles, err := p.store.ListCycles(projectID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, cycles)
}

func (p *Plugin) handleInternalDeleteIssue(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	issue, err := p.store.GetIssue(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}

	if err := p.store.DeleteIssue(id); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	p.broadcastIssue(wsEventIssueDeleted, issue)
	respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// channelHistoryMessage is a single message returned by the channel history endpoint.
type channelHistoryMessage struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Message  string `json:"message"`
	// CreateAt is the post creation time in epoch milliseconds.
	CreateAt int64 `json:"create_at"`
}

// handleInternalGetChannelHistory returns recent messages from a channel.
// Query params:
//   - limit: max messages to return (default 50, max 200)
//   - before: only return messages created before this epoch‐ms timestamp
func (p *Plugin) handleInternalGetChannelHistory(w http.ResponseWriter, r *http.Request) {
	channelID := mux.Vars(r)["id"]
	q := r.URL.Query()

	limit := 50
	if l := q.Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if limit > 200 {
		limit = 200
	}

	beforeTS := int64(0)
	if b := q.Get("before"); b != "" {
		if parsed, err := strconv.ParseInt(b, 10, 64); err == nil {
			beforeTS = parsed
		}
	}

	// Fetch posts. The plugin API returns a PostList which we flatten.
	postList, appErr := p.API.GetPostsForChannel(channelID, 0, limit*2)
	if appErr != nil {
		respondError(w, http.StatusInternalServerError, appErr.Error())
		return
	}

	// Build a sorted slice of posts (oldest first).
	type postEntry struct {
		id       string
		createAt int64
	}
	entries := make([]postEntry, 0, len(postList.Posts))
	for id, post := range postList.Posts {
		entries = append(entries, postEntry{id: id, createAt: post.CreateAt})
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].createAt < entries[j].createAt
	})

	// Resolve usernames in bulk.
	userIDs := make(map[string]bool)
	for _, post := range postList.Posts {
		userIDs[post.UserId] = true
	}
	idList := make([]string, 0, len(userIDs))
	for id := range userIDs {
		idList = append(idList, id)
	}
	usernameMap := make(map[string]string)
	if users, err := p.API.GetUsersByIds(idList); err == nil {
		for _, u := range users {
			usernameMap[u.Id] = u.Username
		}
	}

	// Build the response, applying the "before" filter and limit.
	messages := make([]channelHistoryMessage, 0, limit)
	for _, entry := range entries {
		if beforeTS > 0 && entry.createAt >= beforeTS {
			continue
		}
		post := postList.Posts[entry.id]
		if post.Message == "" {
			continue
		}
		username := usernameMap[post.UserId]
		if username == "" {
			username = post.UserId
		}
		messages = append(messages, channelHistoryMessage{
			UserID:   post.UserId,
			Username: username,
			Message:  post.Message,
			CreateAt: post.CreateAt,
		})
	}

	// Trim to the requested limit (keep the most recent ones).
	if len(messages) > limit {
		messages = messages[len(messages)-limit:]
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"channel_id": channelID,
		"messages":   messages,
		"count":      len(messages),
	})
}
