// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// ConversationParticipant identifies a user in the conversation payload.
type ConversationParticipant struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
}

// ConversationMessagePayload is a single message in the conversation payload.
type ConversationMessagePayload struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Message  string `json:"message"`
	// Timestamp is the message creation time in epoch milliseconds.
	Timestamp int64 `json:"timestamp"`
}

// ConversationPayload is the data sent to the AI service.
type ConversationPayload struct {
	ChannelID       string                       `json:"channel_id"`
	ChannelType     string                       `json:"channel_type"`
	ChannelName     string                       `json:"channel_name"`
	Participants    []ConversationParticipant     `json:"participants"`
	Messages        []ConversationMessagePayload  `json:"messages"`
	StartedAt       string                       `json:"started_at"`
	EndedAt         string                       `json:"ended_at"`
	DurationSeconds int                          `json:"duration_seconds"`
}

// AnalyzeRequest is the full request body sent to the AI service.
type AnalyzeRequest struct {
	Conversation   ConversationPayload `json:"conversation"`
	CallbackURL    string              `json:"callback_url"`
	InternalSecret string              `json:"internal_secret"`
	OpenAIAPIKey   string              `json:"openai_api_key"`
}

// AnalyzeResponse is the response from the AI service.
type AnalyzeResponse struct {
	Summary      string `json:"summary"`
	ActionsTaken int    `json:"actions_taken"`
}

// AIClient calls the external AI service.
type AIClient struct {
	httpClient *http.Client
	serviceURL string
}

// NewAIClient creates a new AI client targeting the given service URL.
func NewAIClient(serviceURL string) *AIClient {
	return &AIClient{
		httpClient: &http.Client{Timeout: 90 * time.Second},
		serviceURL: serviceURL,
	}
}

// Analyze sends a conversation to the AI service for analysis.
func (c *AIClient) Analyze(req *AnalyzeRequest) (*AnalyzeResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest(http.MethodPost, c.serviceURL+"/analyze", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to call AI service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AI service returned status %d", resp.StatusCode)
	}

	var result AnalyzeResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}
