# Contributing Guidelines
Thank you for your interest in contributing! Please see the guidelines below before contributing and [join our "Developers: Desktop App" community channel](https://community.mattermost.com/core/channels/desktop-app) to ask questions from community members and the Mattermost Desktop team.

You can also visit our [developer guide](https://developers.mattermost.com/contribute/desktop/) to learn more information about how to set up your environment, as well as develop and test changes to the Desktop App.

## Issue
We really appreciate your feedback on the Desktop App. We'd ask that before you file an issue that you go through a few steps beforehand.

### Does it reproduce in a web browser?
Mattermost Desktop is based on Electron, which integrates the Chrome engine within a standalone application.
If the problem you encounter can be reproduced on web browsers, it may be an issue with Mattermost server (or Chrome).

If this is the case, please create an issue in the [mattermost-server](https://github.com/mattermost/mattermost-server) or [mattermost-webapp](https://github.com/mattermost/mattermost-webapp) repositories.

### Try "Clear Cache and Reload"
Sometimes issues can be resolved simply by refreshing your Mattermost server within the app.  
You can do this by pressing `CMD/CTRL+SHIFT+R` in the Mattermost Desktop App, or you can go to the menu and select **View > Clear Cache and Reload**.

### Write detailed information
If the issue still persists, please provide detailed information to help us to understand the problem. Include information such as:
* How to reproduce, step-by-step
* Expected behavior (or what is wrong)
* Screenshots (for GUI issues)
* Desktop App version (can be viewed by going to 3-dot menu > Help, or **Menu > Mattermost > About Mattermost** on macOS).
* Operating System
* Mattermost Server version

## Feature idea
If you have an idea for a new feature, we'd love to hear about it!  
Please let us know in the Mattermost Community server by making a post in the [Feature Proposals](https://community-daily.mattermost.com/core/channels/feature-ideas) channel.

## Pull request
If you are interested on working on an issue, we would very much appreciate your help!

We have a list of issues marked as [Help Wanted](https://mattermost.com/pl/help-wanted-desktop) that are available to be worked on.  
If you'd like to take on an issue, simply comment on the issue and one of the Core Contributors will assign it to you.

Once your change is ready, please make sure you perform the following tasks before submitting a pull request:
1. Make sure that the PR passes all automated checks. You can do this by running the following commands:
```
npm run lint:js
npm run check-types
npm run test
```
2. If you are fixing a bug, consider writing a unit test for the change so that the issue does not resurface. If you are adding a new feature, consider additionally writing end-to-end (E2E) tests to thoroughly test the changes.
3. Please complete the [Mattermost CLA](https://mattermost.com/contribute/) prior to submitting a PR.
