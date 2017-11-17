# Mattermost Desktop App Testing

## Release Testing Guide

Thank you for your interest in improving Mattermost software prior to its next release. Your bug reports increase the quality of the Mattermost experience for thousands of people around the world using Mattermost. 

New bug reports benefiting the next release will be documented in the release notes to recognize your unique contribution in the history of the Mattermost open source project.

To contribute to the process of testing the Mattermost Desktop App:

1. If you haven't already, create an account on https://pre-release.mattermost.com/core
 - Set your username to be the same as your GitHub username

2. Install the latest Mattermost Desktop App
 - Download the latest Mattermost Desktop App from the [Mattermost Download page](https://about.mattermost.com/download/#mattermostApps)
 - Follow the [Desktop Application Install Guides](https://about.mattermost.com/default-desktop-app-install-documentation/) to install the app for your platform
 - Use the [Desktop Application's User Guide](https://about.mattermost.com/default-desktop-app-documentation/) to add https://pre-release.mattermost.com/core as a new team
 - Hit "Save" and log in

3. Go to the [Public Test Channel](https://pre-release.mattermost.com/core/channels/public-test-channel) and try the following:
 - Post a message with information on what you're testing, for example: `Testing Mattermost Desktop App 3.4.1 on Windows 10 64-bit`
    - Reply to the post by clicking on "..." then "Reply" with This is a comment including files and upload five (5) files including at least one image, one sound file and one video clip from your Desktop App.
    - Search for the word "Desktop" and click "Jump" on the search result of your own post in Step 3.1. Click into the preview of the files you uploaded and try to download each one.
 - Verify [Team Management works as documented](https://about.mattermost.com/default-desktop-app-documentation/).
 - Verify [App Options work as documented](https://about.mattermost.com/default-desktop-app-documentation/).
 - Verify Menu Bar options work as documented.
 - Use the desktop app for another 15 minutes, trying different features and functionality on the user interface.

4. For any bugs found, please [file a new issue report for each](https://github.com/mattermost/desktop/issues/new).
 - Please include:
    - Operating System
    - Mattermost Desktop App version (See File Menu > Help > Version Number) 
    - Mattermost Server version (See Mattermost Menu > About Mattermost, where Mattermost Menu can be accessed by clicking on three dots next to your profile name) 
    - Clear steps to reproduce the issue
 - [See example of Desktop App issue](https://github.com/mattermost/desktop/issues/355)

5. When your testing is complete, open a GitHub Issue announcing your platform has been verified [using this template](https://github.com/mattermost/desktop/issues/70).

## THANK YOU!

We highly appreciate your help improving the quality of the Mattermost Desktop App for the entire community.

Your testing contribution, including GitHub username, will be listed under the [Verified Operating Systems](TESTING.md#verified-operation-systems) section of this document.

## Verified Operating Systems 

The following chart summarizes the operating systems which the Mattermost Desktop App releases have been tested:

| Version | OS | Issues | Tester | Date |
| :-- | :-- | :-- | :-- | :-- |
| 3.4.1 | Windows 10 64-bit | None Observed | [@tonyD-2016](https://github.com/tonyD-2016) | 2016-12-05 |
| 1.0.7 | Windows 7 SP1 64-bit | [#63](https://github.com/mattermost/desktop/issues/63) | [@it33](https://github.com/it33) | 2016-03-12 |
