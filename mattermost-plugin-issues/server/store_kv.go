// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/public/plugin"
)

const (
	keyProjectPrefix  = "project:"
	keyProjectIndex   = "project_index"
	keyIssuePrefix    = "issue:"
	keyIssueIndex     = "issue_index:"
	keyLabelPrefix    = "label:"
	keyLabelIndex     = "label_index:"
	keyCyclePrefix    = "cycle:"
	keyCycleIndex     = "cycle_index:"
	keyProjectCounter = "project_counter:"

	maxAtomicRetries = 5
)

// KVStore implements Store using the Mattermost plugin KV store.
type KVStore struct {
	api plugin.API
}

// NewKVStore creates a new KV-backed store.
func NewKVStore(api plugin.API) *KVStore {
	return &KVStore{api: api}
}

// --- helpers ---

func (s *KVStore) set(key string, v interface{}) error {
	data, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("marshal %s: %w", key, err)
	}
	if appErr := s.api.KVSet(key, data); appErr != nil {
		return fmt.Errorf("kvset %s: %s", key, appErr.Error())
	}
	return nil
}

func (s *KVStore) get(key string, v interface{}) (bool, error) {
	data, appErr := s.api.KVGet(key)
	if appErr != nil {
		return false, fmt.Errorf("kvget %s: %s", key, appErr.Error())
	}
	if data == nil {
		return false, nil
	}
	if err := json.Unmarshal(data, v); err != nil {
		return false, fmt.Errorf("unmarshal %s: %w", key, err)
	}
	return true, nil
}

func (s *KVStore) delete(key string) error {
	if appErr := s.api.KVDelete(key); appErr != nil {
		return fmt.Errorf("kvdelete %s: %s", key, appErr.Error())
	}
	return nil
}

// getIndex returns the list of IDs stored under an index key.
func (s *KVStore) getIndex(key string) ([]string, error) {
	var ids []string
	found, err := s.get(key, &ids)
	if err != nil {
		return nil, err
	}
	if !found {
		return []string{}, nil
	}
	return ids, nil
}

// addToIndex atomically appends an ID to an index.
func (s *KVStore) addToIndex(key, id string) error {
	for i := 0; i < maxAtomicRetries; i++ {
		oldData, appErr := s.api.KVGet(key)
		if appErr != nil {
			return fmt.Errorf("kvget index %s: %s", key, appErr.Error())
		}

		var ids []string
		if oldData != nil {
			if err := json.Unmarshal(oldData, &ids); err != nil {
				return fmt.Errorf("unmarshal index %s: %w", key, err)
			}
		}

		ids = append(ids, id)
		newData, err := json.Marshal(ids)
		if err != nil {
			return fmt.Errorf("marshal index %s: %w", key, err)
		}

		ok, casErr := s.api.KVCompareAndSet(key, oldData, newData)
		if casErr != nil {
			return fmt.Errorf("cas index %s: %s", key, casErr.Error())
		}
		if ok {
			return nil
		}
	}
	return fmt.Errorf("addToIndex %s: max retries exceeded", key)
}

// removeFromIndex atomically removes an ID from an index.
func (s *KVStore) removeFromIndex(key, id string) error {
	for i := 0; i < maxAtomicRetries; i++ {
		oldData, appErr := s.api.KVGet(key)
		if appErr != nil {
			return fmt.Errorf("kvget index %s: %s", key, appErr.Error())
		}

		var ids []string
		if oldData != nil {
			if err := json.Unmarshal(oldData, &ids); err != nil {
				return fmt.Errorf("unmarshal index %s: %w", key, err)
			}
		}

		newIDs := make([]string, 0, len(ids))
		for _, existingID := range ids {
			if existingID != id {
				newIDs = append(newIDs, existingID)
			}
		}

		newData, err := json.Marshal(newIDs)
		if err != nil {
			return fmt.Errorf("marshal index %s: %w", key, err)
		}

		ok, casErr := s.api.KVCompareAndSet(key, oldData, newData)
		if casErr != nil {
			return fmt.Errorf("cas index %s: %s", key, casErr.Error())
		}
		if ok {
			return nil
		}
	}
	return fmt.Errorf("removeFromIndex %s: max retries exceeded", key)
}

// nextIssueNumber atomically increments and returns the next issue number for a project.
func (s *KVStore) nextIssueNumber(projectID string) (int, error) {
	key := keyProjectCounter + projectID
	for i := 0; i < maxAtomicRetries; i++ {
		oldData, appErr := s.api.KVGet(key)
		if appErr != nil {
			return 0, fmt.Errorf("kvget counter %s: %s", key, appErr.Error())
		}

		var current int
		if oldData != nil {
			if err := json.Unmarshal(oldData, &current); err != nil {
				return 0, fmt.Errorf("unmarshal counter %s: %w", key, err)
			}
		}

		next := current + 1
		newData, err := json.Marshal(next)
		if err != nil {
			return 0, fmt.Errorf("marshal counter: %w", err)
		}

		ok, casErr := s.api.KVCompareAndSet(key, oldData, newData)
		if casErr != nil {
			return 0, fmt.Errorf("cas counter %s: %s", key, casErr.Error())
		}
		if ok {
			return next, nil
		}
	}
	return 0, fmt.Errorf("nextIssueNumber %s: max retries exceeded", projectID)
}

// --- Projects ---

func (s *KVStore) CreateProject(project *Project) error {
	if err := s.set(keyProjectPrefix+project.ID, project); err != nil {
		return err
	}
	return s.addToIndex(keyProjectIndex, project.ID)
}

func (s *KVStore) GetProject(id string) (*Project, error) {
	var project Project
	found, err := s.get(keyProjectPrefix+id, &project)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, fmt.Errorf("project not found: %s", id)
	}
	return &project, nil
}

func (s *KVStore) ListProjects() ([]*Project, error) {
	ids, err := s.getIndex(keyProjectIndex)
	if err != nil {
		return nil, err
	}
	projects := make([]*Project, 0, len(ids))
	for _, id := range ids {
		var p Project
		found, err := s.get(keyProjectPrefix+id, &p)
		if err != nil {
			return nil, err
		}
		if found {
			projects = append(projects, &p)
		}
	}
	return projects, nil
}

func (s *KVStore) UpdateProject(project *Project) error {
	return s.set(keyProjectPrefix+project.ID, project)
}

func (s *KVStore) DeleteProject(id string) error {
	if err := s.delete(keyProjectPrefix + id); err != nil {
		return err
	}
	return s.removeFromIndex(keyProjectIndex, id)
}

// --- Issues ---

func (s *KVStore) CreateIssue(issue *Issue) (*Issue, error) {
	// Get the project to construct the identifier.
	project, err := s.GetProject(issue.ProjectID)
	if err != nil {
		return nil, fmt.Errorf("get project for issue: %w", err)
	}

	num, err := s.nextIssueNumber(issue.ProjectID)
	if err != nil {
		return nil, fmt.Errorf("next issue number: %w", err)
	}
	issue.Identifier = fmt.Sprintf("%s-%d", project.Prefix, num)

	if err := s.set(keyIssuePrefix+issue.ID, issue); err != nil {
		return nil, err
	}
	if err := s.addToIndex(keyIssueIndex+issue.ProjectID, issue.ID); err != nil {
		return nil, err
	}
	return issue, nil
}

func (s *KVStore) GetIssue(id string) (*Issue, error) {
	var issue Issue
	found, err := s.get(keyIssuePrefix+id, &issue)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, fmt.Errorf("issue not found: %s", id)
	}
	return &issue, nil
}

func (s *KVStore) ListIssues(projectID string, params IssueFilterParams) ([]*Issue, error) {
	ids, err := s.getIndex(keyIssueIndex + projectID)
	if err != nil {
		return nil, err
	}

	issues := make([]*Issue, 0, len(ids))
	for _, id := range ids {
		var issue Issue
		found, err := s.get(keyIssuePrefix+id, &issue)
		if err != nil {
			return nil, err
		}
		if !found {
			continue
		}
		if matchesFilter(&issue, params) {
			issues = append(issues, &issue)
		}
	}
	return issues, nil
}

func matchesFilter(issue *Issue, params IssueFilterParams) bool {
	if params.Status != "" && string(issue.Status) != params.Status {
		return false
	}
	if params.Priority != "" && string(issue.Priority) != params.Priority {
		return false
	}
	if params.AssigneeID != "" && issue.AssigneeID != params.AssigneeID {
		return false
	}
	if params.CycleID != "" && issue.CycleID != params.CycleID {
		return false
	}
	if params.SearchQuery != "" {
		q := strings.ToLower(params.SearchQuery)
		if !strings.Contains(strings.ToLower(issue.Title), q) &&
			!strings.Contains(strings.ToLower(issue.Description), q) &&
			!strings.Contains(strings.ToLower(issue.Identifier), q) {
			return false
		}
	}
	return true
}

func (s *KVStore) UpdateIssue(issue *Issue) error {
	return s.set(keyIssuePrefix+issue.ID, issue)
}

func (s *KVStore) DeleteIssue(id string) error {
	issue, err := s.GetIssue(id)
	if err != nil {
		return err
	}
	if err := s.delete(keyIssuePrefix + id); err != nil {
		return err
	}
	return s.removeFromIndex(keyIssueIndex+issue.ProjectID, id)
}

// --- Labels ---

func (s *KVStore) CreateLabel(label *IssueLabel) error {
	if err := s.set(keyLabelPrefix+label.ID, label); err != nil {
		return err
	}
	return s.addToIndex(keyLabelIndex+label.ProjectID, label.ID)
}

func (s *KVStore) GetLabel(id string) (*IssueLabel, error) {
	var label IssueLabel
	found, err := s.get(keyLabelPrefix+id, &label)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, fmt.Errorf("label not found: %s", id)
	}
	return &label, nil
}

func (s *KVStore) ListLabels(projectID string) ([]*IssueLabel, error) {
	ids, err := s.getIndex(keyLabelIndex + projectID)
	if err != nil {
		return nil, err
	}
	labels := make([]*IssueLabel, 0, len(ids))
	for _, id := range ids {
		var label IssueLabel
		found, err := s.get(keyLabelPrefix+id, &label)
		if err != nil {
			return nil, err
		}
		if found {
			labels = append(labels, &label)
		}
	}
	return labels, nil
}

func (s *KVStore) UpdateLabel(label *IssueLabel) error {
	return s.set(keyLabelPrefix+label.ID, label)
}

func (s *KVStore) DeleteLabel(id string) error {
	label, err := s.GetLabel(id)
	if err != nil {
		return err
	}
	if err := s.delete(keyLabelPrefix + id); err != nil {
		return err
	}
	return s.removeFromIndex(keyLabelIndex+label.ProjectID, id)
}

// --- Cycles ---

func (s *KVStore) CreateCycle(cycle *Cycle) error {
	if err := s.set(keyCyclePrefix+cycle.ID, cycle); err != nil {
		return err
	}
	return s.addToIndex(keyCycleIndex+cycle.ProjectID, cycle.ID)
}

func (s *KVStore) GetCycle(id string) (*Cycle, error) {
	var cycle Cycle
	found, err := s.get(keyCyclePrefix+id, &cycle)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, fmt.Errorf("cycle not found: %s", id)
	}
	return &cycle, nil
}

func (s *KVStore) ListCycles(projectID string) ([]*Cycle, error) {
	ids, err := s.getIndex(keyCycleIndex + projectID)
	if err != nil {
		return nil, err
	}
	cycles := make([]*Cycle, 0, len(ids))
	for _, id := range ids {
		var cycle Cycle
		found, err := s.get(keyCyclePrefix+id, &cycle)
		if err != nil {
			return nil, err
		}
		if found {
			cycles = append(cycles, &cycle)
		}
	}
	return cycles, nil
}

func (s *KVStore) UpdateCycle(cycle *Cycle) error {
	return s.set(keyCyclePrefix+cycle.ID, cycle)
}

func (s *KVStore) DeleteCycle(id string) error {
	cycle, err := s.GetCycle(id)
	if err != nil {
		return err
	}
	if err := s.delete(keyCyclePrefix + id); err != nil {
		return err
	}
	return s.removeFromIndex(keyCycleIndex+cycle.ProjectID, id)
}
