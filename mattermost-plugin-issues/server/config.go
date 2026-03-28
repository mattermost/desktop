// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

// configuration captures the plugin's external configuration.
type configuration struct {
	AIServiceURL    string `json:"AIServiceURL"`
	AIServiceSecret string `json:"AIServiceSecret"`
	OpenAIAPIKey    string `json:"OpenAIAPIKey"`
}

func (c *configuration) isAIEnabled() bool {
	return c.AIServiceURL != "" && c.AIServiceSecret != "" && c.OpenAIAPIKey != ""
}
