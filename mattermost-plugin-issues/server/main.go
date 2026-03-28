// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"github.com/mattermost/mattermost/server/public/plugin"
)

func main() {
	plugin.ClientMain(&Plugin{})
}
