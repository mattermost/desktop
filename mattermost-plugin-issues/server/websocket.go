// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	wsEventIssueCreated = "issue_created"
	wsEventIssueUpdated = "issue_updated"
	wsEventIssueDeleted = "issue_deleted"
	wsEventLabelCreated = "label_created"
	wsEventLabelUpdated = "label_updated"
	wsEventLabelDeleted = "label_deleted"
	wsEventCycleCreated = "cycle_created"
	wsEventCycleUpdated = "cycle_updated"
	wsEventCycleDeleted = "cycle_deleted"
)

func (p *Plugin) broadcastIssue(event string, issue *Issue) {
	data, _ := json.Marshal(issue)
	p.API.PublishWebSocketEvent(event, map[string]interface{}{
		"issue": string(data),
	}, &model.WebsocketBroadcast{})
}

func (p *Plugin) broadcastLabel(event string, label *IssueLabel) {
	data, _ := json.Marshal(label)
	p.API.PublishWebSocketEvent(event, map[string]interface{}{
		"label": string(data),
	}, &model.WebsocketBroadcast{})
}

func (p *Plugin) broadcastCycle(event string, cycle *Cycle) {
	data, _ := json.Marshal(cycle)
	p.API.PublishWebSocketEvent(event, map[string]interface{}{
		"cycle": string(data),
	}, &model.WebsocketBroadcast{})
}

func (p *Plugin) broadcastDelete(event string, id string) {
	p.API.PublishWebSocketEvent(event, map[string]interface{}{
		"id": id,
	}, &model.WebsocketBroadcast{})
}
