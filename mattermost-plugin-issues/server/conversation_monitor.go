// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

const conversationTimeout = 2 * time.Minute

// conversationMessage is a single message captured during a conversation.
type conversationMessage struct {
	UserID    string
	Message   string
	Timestamp int64
}

// conversationState tracks an active conversation in any channel.
type conversationState struct {
	channelID    string
	channelType  model.ChannelType
	channelName  string
	memberIDs    []string
	messages     []conversationMessage
	startedAt    time.Time
	lastMsgAt    time.Time
	timer        *time.Timer
}

// conversationEndCallback is called when a conversation ends, after the
// summary has been posted. It receives the conversation state and the resolved
// username cache so the caller can forward the data (e.g. to the AI service).
type conversationEndCallback func(conv *conversationState, usernameCache map[string]string)

// ConversationMonitor detects when conversations start and end in any channel
// (DMs, GMs, public, and private). A conversation starts with the first message
// and ends when 2 minutes pass without any messages. On end it posts a summary
// to the notification channel.
type ConversationMonitor struct {
	api                   plugin.API
	botUserID             string
	notificationChannelID string
	onEnd                 conversationEndCallback
	mu                    sync.Mutex
	conversations         map[string]*conversationState // keyed by channel ID
}

// NewConversationMonitor creates a new monitor instance.
func NewConversationMonitor(api plugin.API, botUserID string, notificationChannelID string, onEnd conversationEndCallback) *ConversationMonitor {
	return &ConversationMonitor{
		api:                   api,
		botUserID:             botUserID,
		notificationChannelID: notificationChannelID,
		onEnd:                 onEnd,
		conversations:         make(map[string]*conversationState),
	}
}

// HandlePost processes a new post, tracking the conversation and
// resetting the inactivity timer.
func (cm *ConversationMonitor) HandlePost(post *model.Post) {
	// Don't track messages posted by the bot itself.
	if post.UserId == cm.botUserID {
		return
	}

	// Don't track messages in the notification channel.
	if post.ChannelId == cm.notificationChannelID {
		return
	}

	channel, appErr := cm.api.GetChannel(post.ChannelId)
	if appErr != nil {
		return
	}

	cm.mu.Lock()
	defer cm.mu.Unlock()

	msg := conversationMessage{
		UserID:    post.UserId,
		Message:   post.Message,
		Timestamp: post.CreateAt,
	}

	conv, exists := cm.conversations[post.ChannelId]
	if !exists {
		// New conversation starting.
		memberIDs := cm.getChannelMemberIDs(channel)
		conv = &conversationState{
			channelID:   post.ChannelId,
			channelType: channel.Type,
			channelName: channel.DisplayName,
			memberIDs:   memberIDs,
			messages:    []conversationMessage{msg},
			startedAt:   time.Now(),
			lastMsgAt:   time.Now(),
		}
		cm.conversations[post.ChannelId] = conv

		cm.api.LogInfo("[ConversationMonitor] conversation started",
			"channel_id", post.ChannelId,
			"channel_type", string(channel.Type),
			"members", strings.Join(memberIDs, ", "),
		)

		conv.timer = time.AfterFunc(conversationTimeout, func() {
			cm.endConversation(post.ChannelId)
		})
		return
	}

	// Existing conversation — record message and reset the timer.
	conv.messages = append(conv.messages, msg)
	conv.lastMsgAt = time.Now()
	conv.timer.Reset(conversationTimeout)
}

// FlushConversation immediately ends the conversation in the given channel,
// stopping its inactivity timer and triggering the summary + AI callback.
// Returns true if a conversation existed and was flushed.
func (cm *ConversationMonitor) FlushConversation(channelID string) bool {
	cm.mu.Lock()
	conv, exists := cm.conversations[channelID]
	if !exists {
		cm.mu.Unlock()
		return false
	}
	conv.timer.Stop()
	delete(cm.conversations, channelID)
	cm.mu.Unlock()

	cm.api.LogInfo("[ConversationMonitor] conversation flushed by @fiona mention",
		"channel_id", channelID,
		"messages", fmt.Sprintf("%d", len(conv.messages)),
	)

	cm.postConversationSummary(conv)
	return true
}

// endConversation is called when the inactivity timer fires.
func (cm *ConversationMonitor) endConversation(channelID string) {
	cm.mu.Lock()
	conv, exists := cm.conversations[channelID]
	if !exists {
		cm.mu.Unlock()
		return
	}
	delete(cm.conversations, channelID)
	cm.mu.Unlock()

	cm.postConversationSummary(conv)
}

// postConversationSummary sends a message to the notification channel
// with the full transcript of the ended conversation.
func (cm *ConversationMonitor) postConversationSummary(conv *conversationState) {
	// Resolve usernames for readable output.
	allUserIDs := collectUserIDs(conv)
	usernameCache := cm.resolveUsernames(allUserIDs)

	label := channelTypeLabel(conv.channelType)
	duration := conv.lastMsgAt.Sub(conv.startedAt)

	// Build member display names.
	memberNames := make([]string, len(conv.memberIDs))
	for i, id := range conv.memberIDs {
		memberNames[i] = usernameCache[id]
	}

	// Build the message.
	var sb strings.Builder
	if conv.channelType == model.ChannelTypeOpen || conv.channelType == model.ChannelTypePrivate {
		sb.WriteString(fmt.Sprintf("#### %s conversation ended — ~%s\n", label, conv.channelName))
	} else {
		sb.WriteString(fmt.Sprintf("#### %s conversation ended\n", label))
	}
	sb.WriteString(fmt.Sprintf("**Participants:** %s\n", strings.Join(memberNames, ", ")))
	sb.WriteString(fmt.Sprintf("**Duration:** %s | **Messages:** %d\n", duration.Round(time.Second), len(conv.messages)))
	sb.WriteString("\n---\n")

	for _, msg := range conv.messages {
		username := usernameCache[msg.UserID]
		if username == "" {
			username = msg.UserID
		}
		ts := time.UnixMilli(msg.Timestamp).Format("15:04:05")
		sb.WriteString(fmt.Sprintf("**[%s] %s:** %s\n", ts, username, msg.Message))
	}

	post := &model.Post{
		UserId:    cm.botUserID,
		ChannelId: cm.notificationChannelID,
		Message:   sb.String(),
	}
	if _, appErr := cm.api.CreatePost(post); appErr != nil {
		cm.api.LogError("[ConversationMonitor] failed to post summary", "error", appErr.Error())
	}

	// Invoke the callback so the plugin can forward to the AI service.
	if cm.onEnd != nil {
		cm.onEnd(conv, usernameCache)
	}
}

// collectUserIDs gathers all unique user IDs from members and message authors.
func collectUserIDs(conv *conversationState) []string {
	seen := make(map[string]bool)
	for _, id := range conv.memberIDs {
		seen[id] = true
	}
	for _, msg := range conv.messages {
		seen[msg.UserID] = true
	}
	ids := make([]string, 0, len(seen))
	for id := range seen {
		ids = append(ids, id)
	}
	return ids
}

// resolveUsernames maps user IDs to @usernames.
func (cm *ConversationMonitor) resolveUsernames(userIDs []string) map[string]string {
	cache := make(map[string]string, len(userIDs))
	for _, id := range userIDs {
		cache[id] = id // fallback to ID
	}
	users, appErr := cm.api.GetUsersByIds(userIDs)
	if appErr != nil {
		return cache
	}
	for _, u := range users {
		cache[u.Id] = "@" + u.Username
	}
	return cache
}

// getChannelMemberIDs returns the user IDs participating in a channel.
// For DMs it parses the channel name; for all other types it queries the API.
func (cm *ConversationMonitor) getChannelMemberIDs(channel *model.Channel) []string {
	if channel.Type == model.ChannelTypeDirect {
		parts := strings.SplitN(channel.Name, "__", 2)
		if len(parts) == 2 {
			return parts
		}
		return []string{channel.Name}
	}

	members, appErr := cm.api.GetChannelMembers(channel.Id, 0, 200)
	if appErr != nil {
		return nil
	}
	ids := make([]string, len(members))
	for i, m := range members {
		ids[i] = m.UserId
	}
	return ids
}

func channelTypeLabel(ct model.ChannelType) string {
	switch ct {
	case model.ChannelTypeDirect:
		return "DM"
	case model.ChannelTypeGroup:
		return "Group"
	case model.ChannelTypePrivate:
		return "Private Channel"
	default:
		return "Channel"
	}
}
