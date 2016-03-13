# Mattermost Desktop App Testing

## Release Testing Guide

To contribute to the process of testing the Mattermost Desktop App: 

1. If you haven't already, create an account on https://pre-release.mattermost.com/core
  - Set your username to be the same as your GitHub username
2. Follow the testing guide for your platform
  - [Windows Testing Guide](#windows-testing-guide)
3. Go to the [Public Test Channel](https://pre-release.mattermost.com/core/channels/public-test-channel) and try the following: 
  1. Post the message with information on what you're testing, for example: `Testing Mattermost Desktop App 1.07 on Windows 7 SP1 64-bit`
  2. Reply to the post by clicking on "**...**" then "**Reply**" with `This is a comment including files` and upload five (5) files including at least one image, one sound file and one video clip from your Android device.
  3. Search for the word "Desktop" and click "Jump" on the search result of your own post in Step 3.1. Click into the preview of the files you uploaded and try to download each one.
4. For any bugs found, please [file an issue report for each](https://github.com/mattermost/desktop/blob/master/CONTRIBUTING.md#issue). 
  1. Please include: 
    - STEPS TO REPRODUCE
    - MATTERMOST DESKTOP APP VERSION
    - OPERATING SYSTEM VERSION 
    - SCREENSHOT IF APPLICABLE
  2. See [example of Mattermost Desktop issue](https://github.com/mattermost/desktop/issues/63)
5. When your testing is complete, open a GitHub Issue announcing your device has been verified
  1. Open an issue [using template for announcing a platform has been tested](https://github.com/mattermost/desktop/issues/70).
  
## THANK YOU!
We highly appreciate your help improving the quality of the Mattermost Desktop App for the entire community. 

Your testing contribution, including GitHub username, will be listed under the [Verified Operating Systems](TESTING.md#verified-operation-systems) section of this document.

## Verified Operating Systems 

The following chart summarizes the operating systems which the Mattermost Desktop App releases have been tested:

| Version | OS | Issues | Tester | Date |
|:--- |:--- |:--- |:--- |:--- |
| 1.0.7 | Windows 7 SP1 64-bit | [#63](https://github.com/mattermost/desktop/issues/63) | [@it33](https://github.com/it33) | 2016-03-12 |

## Testing Guides by Operating System

The following guides offer operating system specific instructions for testing the Mattermost Desktop application.

### Windows Testing Guide

1. Install the Mattermost desktop application following the [step-by-step Windows setup guide](docs/setup.md#step-by-step-windows-setup) to connect to the `https://pre-release.mattermost.com/core` team site.
2. Verify [Start Menu and Task Bar shortcuts open the application as documented.](docs/setup.md#start-menu-and-task-bar-shortcuts).
3. Verify [Menu Bar options work as documented](docs/setup.md#menu-bar).
4. Follow the [Release Testing Guide](#release-testing-guide) to file issues and report completion of testing.
