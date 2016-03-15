# Contributing Guidelines
Thank you for your contributing! My requests are few things. Please read below.

## Issue
Thank you for feedback. When you report a problem, please pay attention to following points.

### Does it happen on web browsers? (especially Chrome)
electron-mattermost is based on Electron. It integrates Chrome as a browser window.
If the problem appears on web browsers, it may be the issue for Mattermost (or Chrome).

### Try "Clear Cache and Reload"
It's available as `Ctrl(Command) + Shift + R`.
Some layout problems are caused by browser cache.
Especially, this kind of issue might happen when you have updated Mattermost server.

### Write detailed information
Following points are very helpful to understand the problem.

* How to reproduce, step-by-step
* Expected behavior (or what is wrong)
* Screenshots (for GUI issues)
* Application version
* Operating system
* Mattermost version

## Feature idea
Please see http://www.mattermost.org/feature-requests/ .

## Pull request
PR is welcome. Thank you for your great works!

When you edit the code, please run `npm run prettify` before your `git commit`.
Codes will be formatted.

Then, such as following points are helpful.

* Tested OS
* Tested Mattermost version
* Test codes for your changes
