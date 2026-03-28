// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// Plugin implements the Mattermost plugin interface.
type Plugin struct {
	plugin.MattermostPlugin

	configLock          sync.RWMutex
	config              *configuration
	router              *mux.Router
	store               Store
	conversationMonitor *ConversationMonitor
	botUserID           string
	aiClient            *AIClient
}

// OnActivate is called when the plugin is activated.
func (p *Plugin) OnActivate() error {
	p.store = NewKVStore(p.API)
	p.router = p.initRouter()

	botUserID, err := p.ensureBot()
	if err != nil {
		return err
	}
	p.botUserID = botUserID

	notifChannel, chErr := p.ensureNotificationChannel()
	if chErr != nil {
		return fmt.Errorf("failed to create notification channel: %w", chErr)
	}

	// Load configuration.
	var config configuration
	if err := p.API.LoadPluginConfiguration(&config); err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}
	p.configLock.Lock()
	p.config = &config
	p.configLock.Unlock()

	if config.isAIEnabled() {
		p.aiClient = NewAIClient(config.AIServiceURL)
		p.API.LogInfo("[ConversationMonitor] AI analysis enabled",
			"ai_service_url", config.AIServiceURL,
		)
	} else {
		p.API.LogInfo("[ConversationMonitor] AI analysis disabled (missing configuration)")
	}

	p.conversationMonitor = NewConversationMonitor(p.API, p.botUserID, notifChannel.Id, p.onConversationEnd)

	if err := p.API.RegisterCommand(getCommand()); err != nil {
		return err
	}

	p.API.LogInfo("[ConversationMonitor] plugin activated",
		"bot_user_id", p.botUserID,
		"notification_channel_id", notifChannel.Id,
	)

	return nil
}

// OnConfigurationChange is called when the plugin configuration is updated.
func (p *Plugin) OnConfigurationChange() error {
	var config configuration
	if err := p.API.LoadPluginConfiguration(&config); err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	p.configLock.Lock()
	p.config = &config
	p.configLock.Unlock()

	if config.isAIEnabled() {
		p.aiClient = NewAIClient(config.AIServiceURL)
	} else {
		p.aiClient = nil
	}

	return nil
}

// onConversationEnd is called by the ConversationMonitor when a conversation
// ends. It sends the transcript to the AI service for analysis in a goroutine.
func (p *Plugin) onConversationEnd(conv *conversationState, usernameCache map[string]string) {
	p.configLock.RLock()
	config := p.config
	client := p.aiClient
	p.configLock.RUnlock()

	if client == nil || config == nil || !config.isAIEnabled() {
		return
	}

	// Only analyze DMs and group messages.
	if conv.channelType != model.ChannelTypeDirect && conv.channelType != model.ChannelTypeGroup {
		return
	}

	// Build participants list.
	participants := make([]ConversationParticipant, len(conv.memberIDs))
	for i, id := range conv.memberIDs {
		username := usernameCache[id]
		if username == "" {
			username = id
		}
		// Strip leading @ if present.
		if len(username) > 0 && username[0] == '@' {
			username = username[1:]
		}
		participants[i] = ConversationParticipant{
			UserID:   id,
			Username: username,
		}
	}

	// Build messages list.
	messages := make([]ConversationMessagePayload, len(conv.messages))
	for i, msg := range conv.messages {
		username := usernameCache[msg.UserID]
		if username == "" {
			username = msg.UserID
		}
		if len(username) > 0 && username[0] == '@' {
			username = username[1:]
		}
		messages[i] = ConversationMessagePayload{
			UserID:   msg.UserID,
			Username: username,
			Message:  msg.Message,
			Timestamp: msg.Timestamp,
		}
	}

	duration := conv.lastMsgAt.Sub(conv.startedAt)

	// Build the Mattermost site URL for callbacks.
	siteURL := "http://localhost:8065"
	if cfg := p.API.GetConfig(); cfg != nil && cfg.ServiceSettings.SiteURL != nil && *cfg.ServiceSettings.SiteURL != "" {
		siteURL = *cfg.ServiceSettings.SiteURL
	}
	callbackURL := siteURL + "/plugins/com.mattermost.issues"

	req := &AnalyzeRequest{
		Conversation: ConversationPayload{
			ChannelID:       conv.channelID,
			ChannelType:     string(conv.channelType),
			ChannelName:     conv.channelName,
			Participants:    participants,
			Messages:        messages,
			StartedAt:       conv.startedAt.Format(time.RFC3339),
			EndedAt:         conv.lastMsgAt.Format(time.RFC3339),
			DurationSeconds: int(duration.Seconds()),
		},
		CallbackURL:    callbackURL,
		InternalSecret: config.AIServiceSecret,
		OpenAIAPIKey:   config.OpenAIAPIKey,
	}

	notifChannelID := p.conversationMonitor.notificationChannelID

	go func() {
		p.API.LogInfo("[ConversationMonitor] sending conversation to AI service",
			"channel_id", conv.channelID,
			"messages", fmt.Sprintf("%d", len(messages)),
		)

		result, err := client.Analyze(req)
		if err != nil {
			p.API.LogError("[ConversationMonitor] AI analysis failed", "error", err.Error())
			return
		}

		if result.Summary == "" && result.ActionsTaken == 0 {
			p.API.LogInfo("[ConversationMonitor] AI found no actionable items")
			return
		}

		// Post AI analysis summary to the notification channel.
		summary := fmt.Sprintf("#### :robot_face: AI Analysis\n%s\n\n*Actions taken: %d*", result.Summary, result.ActionsTaken)
		post := &model.Post{
			UserId:    p.botUserID,
			ChannelId: notifChannelID,
			Message:   summary,
		}
		if _, appErr := p.API.CreatePost(post); appErr != nil {
			p.API.LogError("[ConversationMonitor] failed to post AI summary", "error", appErr.Error())
		}
	}()
}

// MessageHasBeenPosted is invoked after a message is posted. It feeds the
// post into the conversation monitor to track DM conversation lifecycles.
// If the message mentions @fiona, the conversation is flushed immediately.
func (p *Plugin) MessageHasBeenPosted(_ *plugin.Context, post *model.Post) {
	p.conversationMonitor.HandlePost(post)

	if containsFionaMention(post.Message) {
		p.conversationMonitor.FlushConversation(post.ChannelId)
	}
}

func containsFionaMention(message string) bool {
	return strings.Contains(strings.ToLower(message), "@fiona")
}

// ensureNotificationChannel finds or creates the "oli-notificacions" channel.
func (p *Plugin) ensureNotificationChannel() (*model.Channel, error) {
	teams, appErr := p.API.GetTeams()
	if appErr != nil {
		return nil, fmt.Errorf("could not get teams: %s", appErr.Error())
	}
	if len(teams) == 0 {
		return nil, fmt.Errorf("no teams found")
	}
	teamID := teams[0].Id

	ch, appErr := p.API.GetChannelByName(teamID, "oli-notificacions", false)
	if appErr == nil {
		return ch, nil
	}

	ch, appErr = p.API.CreateChannel(&model.Channel{
		TeamId:      teamID,
		Name:        "oli-notificacions",
		DisplayName: "Oli Notificacions",
		Type:        model.ChannelTypeOpen,
		Purpose:     "Conversation end notifications from the Issues Tracker plugin.",
	})
	if appErr != nil {
		return nil, fmt.Errorf("could not create channel: %s", appErr.Error())
	}
	return ch, nil
}

// ensureBot finds or creates the "oli-bot" bot user.
func (p *Plugin) ensureBot() (string, error) {
	botUserID, err := p.API.EnsureBotUser(&model.Bot{
		Username:    "oli-bot",
		DisplayName: "Oli Bot",
		Description: "Posts conversation end notifications.",
	})
	if err != nil {
		return "", err
	}
	return botUserID, nil
}

// ServeHTTP routes incoming HTTP requests to the plugin's REST API.
func (p *Plugin) ServeHTTP(_ *plugin.Context, w http.ResponseWriter, r *http.Request) {
	p.router.ServeHTTP(w, r)
}
