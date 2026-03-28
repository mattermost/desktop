// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"strings"
	"time"
)

// IssueStatus represents the workflow state of an issue.
type IssueStatus string

const (
	IssueStatusBacklog    IssueStatus = "backlog"
	IssueStatusTodo       IssueStatus = "todo"
	IssueStatusInProgress IssueStatus = "in_progress"
	IssueStatusInReview   IssueStatus = "in_review"
	IssueStatusDone       IssueStatus = "done"
	IssueStatusCancelled  IssueStatus = "cancelled"
)

var validStatuses = map[IssueStatus]bool{
	IssueStatusBacklog:    true,
	IssueStatusTodo:       true,
	IssueStatusInProgress: true,
	IssueStatusInReview:   true,
	IssueStatusDone:       true,
	IssueStatusCancelled:  true,
}

func (s IssueStatus) IsValid() bool {
	return validStatuses[s]
}

func (s IssueStatus) IsCompleted() bool {
	return s == IssueStatusDone || s == IssueStatusCancelled
}

// IssuePriority represents the urgency of an issue.
type IssuePriority string

const (
	IssuePriorityUrgent IssuePriority = "urgent"
	IssuePriorityHigh   IssuePriority = "high"
	IssuePriorityMedium IssuePriority = "medium"
	IssuePriorityLow    IssuePriority = "low"
	IssuePriorityNone   IssuePriority = "none"
)

var validPriorities = map[IssuePriority]bool{
	IssuePriorityUrgent: true,
	IssuePriorityHigh:   true,
	IssuePriorityMedium: true,
	IssuePriorityLow:    true,
	IssuePriorityNone:   true,
}

func (p IssuePriority) IsValid() bool {
	return validPriorities[p]
}

// Project groups issues under a shared prefix and identifier counter.
type Project struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Prefix          string `json:"prefix"`
	NextIssueNumber int    `json:"next_issue_number"`
	CreatedBy       string `json:"created_by"`
	CreatedAt       int64  `json:"created_at"`
}

func (p *Project) IsValid() error {
	if p.Name == "" {
		return fmt.Errorf("project name is required")
	}
	if p.Prefix == "" {
		return fmt.Errorf("project prefix is required")
	}
	if len(p.Prefix) > 10 {
		return fmt.Errorf("project prefix must be 10 characters or fewer")
	}
	return nil
}

// Issue is the core entity — a trackable unit of work.
type Issue struct {
	ID            string        `json:"id"`
	ProjectID     string        `json:"project_id"`
	Identifier    string        `json:"identifier"`
	Title         string        `json:"title"`
	Description   string        `json:"description"`
	Status        IssueStatus   `json:"status"`
	Priority      IssuePriority `json:"priority"`
	LabelIDs      []string      `json:"label_ids"`
	AssigneeID    string        `json:"assignee_id,omitempty"`
	CycleID       string        `json:"cycle_id,omitempty"`
	EstimateHours float64       `json:"estimate_hours"`
	CreatedBy     string        `json:"created_by"`
	CreatedAt     int64         `json:"created_at"`
	UpdatedAt     int64         `json:"updated_at"`
	CompletedAt   int64         `json:"completed_at,omitempty"`
	SortOrder     int           `json:"sort_order"`
}

func (i *Issue) IsValid() error {
	if i.Title == "" {
		return fmt.Errorf("issue title is required")
	}
	if i.ProjectID == "" {
		return fmt.Errorf("project ID is required")
	}
	if !i.Status.IsValid() {
		return fmt.Errorf("invalid status: %s", i.Status)
	}
	if !i.Priority.IsValid() {
		return fmt.Errorf("invalid priority: %s", i.Priority)
	}
	return nil
}

// IssueLabel is a colored tag that can be applied to issues.
type IssueLabel struct {
	ID        string `json:"id"`
	ProjectID string `json:"project_id"`
	Name      string `json:"name"`
	Color     string `json:"color"`
}

func (l *IssueLabel) IsValid() error {
	if l.Name == "" {
		return fmt.Errorf("label name is required")
	}
	if l.ProjectID == "" {
		return fmt.Errorf("project ID is required")
	}
	if l.Color == "" {
		return fmt.Errorf("label color is required")
	}
	return nil
}

// Cycle represents a sprint or iteration period.
type Cycle struct {
	ID        string `json:"id"`
	ProjectID string `json:"project_id"`
	Name      string `json:"name"`
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
	IsActive  bool   `json:"is_active"`
}

func (c *Cycle) IsValid() error {
	if c.Name == "" {
		return fmt.Errorf("cycle name is required")
	}
	if c.ProjectID == "" {
		return fmt.Errorf("project ID is required")
	}
	if c.StartDate == "" || c.EndDate == "" {
		return fmt.Errorf("start and end dates are required")
	}
	return nil
}

// Request/response types for the REST API.

type CreateProjectRequest struct {
	Name   string `json:"name"`
	Prefix string `json:"prefix"`
}

type CreateIssueRequest struct {
	Title         string        `json:"title"`
	Description   string        `json:"description"`
	Status        IssueStatus   `json:"status"`
	Priority      IssuePriority `json:"priority"`
	LabelIDs      []string      `json:"label_ids"`
	AssigneeID    string        `json:"assignee_id"`
	CycleID       string        `json:"cycle_id"`
	EstimateHours float64       `json:"estimate_hours"`
}

type UpdateIssueRequest struct {
	Title         *string        `json:"title,omitempty"`
	Description   *string        `json:"description,omitempty"`
	Status        *IssueStatus   `json:"status,omitempty"`
	Priority      *IssuePriority `json:"priority,omitempty"`
	LabelIDs      []string       `json:"label_ids,omitempty"`
	AssigneeID    *string        `json:"assignee_id,omitempty"`
	CycleID       *string        `json:"cycle_id,omitempty"`
	EstimateHours *float64       `json:"estimate_hours,omitempty"`
	SortOrder     *int           `json:"sort_order,omitempty"`
}

type IssueListResponse struct {
	Issues     []*Issue `json:"issues"`
	TotalCount int      `json:"total_count"`
}

type IssueFilterParams struct {
	Status      string `json:"status"`
	Priority    string `json:"priority"`
	AssigneeID  string `json:"assignee_id"`
	CycleID     string `json:"cycle_id"`
	SearchQuery string `json:"search_query"`
}

type CreateLabelRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

type UpdateLabelRequest struct {
	Name  *string `json:"name,omitempty"`
	Color *string `json:"color,omitempty"`
}

type CreateCycleRequest struct {
	Name      string `json:"name"`
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
}

type UpdateCycleRequest struct {
	Name      *string `json:"name,omitempty"`
	StartDate *string `json:"start_date,omitempty"`
	EndDate   *string `json:"end_date,omitempty"`
	IsActive  *bool   `json:"is_active,omitempty"`
}

func nowMillis() int64 {
	return time.Now().UnixMilli()
}

func normalizePrefix(prefix string) string {
	return strings.ToUpper(strings.TrimSpace(prefix))
}
