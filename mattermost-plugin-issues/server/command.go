// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

func getCommand() *model.Command {
	return &model.Command{
		Trigger:          "issues",
		AutoComplete:     true,
		AutoCompleteDesc: "Open the issues tracker",
		AutoCompleteHint: "",
		DisplayName:      "Issues Tracker",
	}
}

func (p *Plugin) ExecuteCommand(_ *plugin.Context, _ *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	return &model.CommandResponse{
		ResponseType: model.CommandResponseTypeEphemeral,
		Text:         "Click the **Issues** button in the channel header to open the tracker.",
	}, nil
}
