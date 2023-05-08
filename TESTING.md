# Mattermost Desktop App Testing

## Automated Testing Guide
You can find information about our automated tests in the [developer guide](https://developers.mattermost.com/contribute/desktop/testing/)

If you are interested in contributing to our automated test library, please read our [contributing guidelines](https://github.com/mattermost/desktop/blob/master/CONTRIBUTING.md).

## Release Testing Guide

Thank you for your interest in improving Mattermost software prior to its next release. Your bug reports increase the quality of the Mattermost experience for thousands of people around the world using Mattermost. 

New bug reports benefiting the next release will be documented in the release notes to recognize your unique contribution in the history of the Mattermost open source project.

To contribute to the process of testing the Mattermost Desktop App:

1. If you haven't already, create an account on our [Community Server](https://community.mattermost.com/)
 - Set your username to be the same as your GitHub username

2. Install the latest Mattermost Desktop App
 - Download the latest pre-release Mattermost Desktop App from the [GitHub Releases page](https://github.com/mattermost/desktop/releases).
 - Follow the [Desktop Application Install Guides](https://docs.mattermost.com/install/desktop-app-install.html) to install the app for your platform.
 - Use the [Managing Servers Guide](https://docs.mattermost.com/messaging/managing-desktop-app-servers.html) to add https://community.mattermost.com/core as a new server.
 - Select "Save" and log in to Mattermost.

3. Go to the [Public Test Channel](https://community.mattermost.com/core/channels/public-test-channel) and try the following:
 - Post a message with information on what you're testing, for example: `Testing Mattermost Desktop App 5.0.2 on Windows 10 64-bit`.
    - Reply to the post by clicking on "..." then "Reply" with This is a comment including files and upload five (5) files including at least one image, one sound file and one video clip from your Desktop App.
    - Search for the word "Desktop" and click "Jump" on the search result of your own post in Step 3.1. Click into the preview of the files you uploaded and try to download each one.
 - Verify [Server Management works as documented](https://docs.mattermost.com/messaging/managing-desktop-app-servers.html).
 - Verify [App Options work as documented](https://docs.mattermost.com/messaging/managing-desktop-app-options.html).
 - Verify Menu Bar options work as documented.
 - Use the desktop app for another 15 minutes, trying different features and functionality on the user interface.

4. For any bugs found, please [file a new issue report for each](https://github.com/mattermost/desktop/issues/new).
 - Please include:
    - Operating System
    - Mattermost Desktop App version (See File Menu > Help > Version Number) 
    - Mattermost Server version (See Mattermost Menu > About Mattermost, where Mattermost Menu can be accessed by clicking on three dots next to your profile name) 
    - Clear steps to reproduce the issue
 - [See example of Desktop App issue](https://github.com/mattermost/desktop/issues/355)
