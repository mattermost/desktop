// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * GitHub login → Mattermost username for E2E channel @mentions.
 *
 * Incoming webhooks ping `@username` on the destination team. GitHub login is
 * not always the Mattermost username, so this map is explicit and empty by
 * default — do not guess. Add a login only after confirming that person's
 * username on the team that receives desktop-master / desktop-pr / CMT posts.
 *
 * Example: module.exports = {DHaussermann: 'confirmed-mm-username'};
 *
 * Optional CI override (JSON object, same shape): secret `MM_GITHUB_USERNAME_MAP`.
 *
 * @type {Record<string, string>}
 */
module.exports = {};
