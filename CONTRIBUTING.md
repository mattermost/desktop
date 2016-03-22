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
Pull requests are welcome. Thank you for your great work!

1. When you edit the code, please run `npm run prettify` to format your code before `git commit`. 
2. In the description of your pull request, please include: 
   * Operating System version on which you tested 
   * Mattermost server version on which you tested 
   * New or updated unit tests for your changes 
3. Please complete the [Mattermost CLA](http://www.mattermost.org/mattermost-contributor-agreement/) prior to submitting a PR.

