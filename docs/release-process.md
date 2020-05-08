# Release Process

This document outlines the release process for the Mattermost Desktop App. It is drawn from the development process used by the [Mattermost core team](https://docs.mattermost.com/process/feature-release.html).

Desktop App releases ship at the same time as the next server Feature release after the latest [Electron update](https://github.com/electron/electron/releases), which means approximately every 2-4 months. The Desktop App releases ship on the 16th of the month and follow the server release schedule.

In cases where there are requested features completed prior to the next upcoming Electron update, the next Desktop App release will be prepared at the same time as the next server Feature release regardless of whether a new Electron update has shipped.

A dot release will be prepared sooner if Electron releases a security update, or if other urgent bugs are found.

## Release Timeline

Notes:
- All cut-off dates are based on 15:00 GMT (UTC-00) on the day stated. 
- T-minus counts are measured in "working days" (weekdays other than major holidays concurrent in US and Canada) prior to release day.

### A. (Code complete date of previous release) Beginning of release

Pre-work for the current release begins at the code complete date of the previous release. See "Code Complete and Release Candidate Cut" section below for details.

### B. (T-minus 20 working days) Feature Complete

No pull requests for features should be merged to the current release after this date. In special cases, exceptions can be made by the Release Manager.

1. Release Manager:
    - Post this checklist in Desktop App channel
    - Ensure that feature PR reviews are prioritized, and post a list of outstanding feature PRs in the Desktop App channel
    - After release branches are cut, ask dev to cut RC1 for QA testing
    - After RC1 is cut, make an announcement for R&D to use the RC as their daily client to get more test coverage
    - Submit changelog with updates for improvements, bug fixes, known issues, and contributors
    - Ask PMs if there are any notable breaking changes or deprecated features in the release
    - Start posting a daily Zero Bug Balance query (posted until zero bugs or day of release)
    - Create meta issue for release in GitHub to let contributors and users know about the upcoming release. See [example issue](https://github.com/mattermost/desktop/issues/271)
    - Confirm date of marketing announcement for the release and update Desktop App channel header if needed
2. Dev/PM/QA:
    - Prioritize reviewing, testing, and merging of pull requests for current release until there are no more tickets in the [pull request queue](https://github.com/mattermost/desktop/pulls) marked for the current release
    - Verify `version` in [package.json](https://github.com/mattermost/desktop/blob/master/package.json) and [src/package.json](https://github.com/mattermost/desktop/blob/master/src/package.json) are updated to the new release version
    - Master is tagged and branched and "Release Candidate 1" is cut (e.g. 1.1.0-RC1)
3. Marketing:
    - Tweet announcement that RC1 is ready
    
### C. (T-minus 15 working days) Judgment Day

Day when Release Manager and PMs decide which major features are included in the release, and which are postponed.

1. Release Manager:
    - Post this checklist in Desktop App channel
    - Verify all items in the last posted release checklist are complete
    - Update Changelog PR based on what’s in/out of the release
    - Post a reminder to devs in the Desktop App channel of the code complete date with the ZBB count
    - Ask release PM to review the JIRA tickets remaining in the current release fix version and push those that won’t make it to the next fix version
2. PM:
    - Finalize roadmap for next release, and identify planned marketing bullet points
3. Marketing:
    - Start drafting blog post, tweet, and email for the release announcement

### C. (T-minus 14 working days) Code Complete

**Stabilization** period begins when all features for release have been committed. During this period, only **bugs** can be committed to the release branch. Non-bug pull requests are tagged for the next version.

1. Release Manager:
    - Post this checklist in Desktop App channel
    - Verify all items in the last posted release checklist are complete
    - Update meta issue for release in GitHub with a link to the changelog
2. Dev:
    - Prioritize reviewing, updating, and merging of pull requests for current release until there are no more tickets in the pull request queue marked for the current release

### D. (T-minus 8 working days) Release Candidate Testing

1. Release Manager:
    - Post this checklist in Desktop App channel
    - Verify all items in the last posted release checklist are complete
    - Post links to final tickets for next RC to the Desktop App channel
2. QA:
    - Update Desktop App channel header with links to RC instances and testing spreadsheet
    - Post release testing instructions to Desktop App channel with a list of known issues
    - Coordinate testing:  
        - Update the RC Testing Spreadsheet to cover any changes or new features, confirm that known issues are listed in the relevant tests, and assign each area to a team member
3. Team:
    - Test assigned areas of the Release Candidate Testing spreadsheet
    - Daily triage of hotfix candidates and decide whether and when to cut next RC or final
4. Dev:
    - Submit PRs for hotfixes against the release branch, and review, test and merge prior to next RC
    - Push next RC to acceptance and announce in Desktop App channel with new RC link
5. Docs:
    - Submit Changelog PR for team review
    - Submit any remaining documentation PRs for product updates in the release

### E. (T-minus 7 working days) Release Candidate Testing Finished

1. Release Manager:
    - Post this checklist in Desktop App channel
    - Verify all items in the last posted release checklist are complete
    - Check that the following are updated in the Changelog:
        - Known issues
        - Contributors
        - Breaking changes
2. Team:
    - Finish assigned areas of the Release Candidate Testing spreadsheet
    - Continue triaging hotfix candidates and decide on whether and when to cut next RC or final
    - If no blocking issues are found sign off on the release
3. Marketing:
    - Finish drafts of art work for Twitter announcement and send to marketing lead for review

### F. (T-minus 2 working days) Release Build Cut

The final release is cut. If an urgent and important issue needs to be addressed between major releases, a bug fix release (e.g. 1.1.1) may be created.

1. Release Manager:
    - Post this checklist in Desktop App channel
    - Verify all items in the last posted release checklist are complete
    - Update the links in [Mattermost download page](https://www.mattermost.org/download/), [installation guides](https://docs.mattermost.com/install/desktop.html) and [MSI installer guides](https://docs.mattermost.com/install/desktop-msi-gpo.html)
    - Merge changelog PR after review is complete
       - If there is a security fix, confirm the Changelog recommends upgrade, with a note mentioning the security level and thanking the security researcher
    - Draft [Mattermost Security Updates](http://about.mattermost.com/security-updates/) if applicable, but do not post until seven days after official release
       - Check Security Issues spreadsheet and confirm disclosure text
    - Close GitHub meta ticket for the release
2. Build:
    - Tag a new release (e.g. 1.1.0) and run an official build which should be essentially identical to the last RC
    - Post in Desktop App channel with links to all supported distributions and SHA-256 checksum
    - Complete code-signing and confirm that it worked well by testing the download links and keeping an eye out for any warnings or issues. Also, use these commands to verify the signatures:
      - Windows: On "Developer Command Prompt" (bundled in Visual Studio),
      `signtool verify /pa /all EXE_TO_VERIFY`
      - Mac: On console,
      `codesign --verify --deep --strict --verbose=2 Mattermost.app`
3. Docs:
    - Finalize all documentation
4. Dev:
    - Publish the release in [GitHub repository](https://github.com/mattermost/desktop/releases)
    - Merge changes made to release branch into master
5. Marketing:
    - Schedule Twitter announcement for 08:00 PST on the date of marketing announcement

If a bug fix release is required, run through the following steps:

1. Dev:
    - Submit, review and merge patches for the release branch
    - Cut an RC containing all bug fixes
2. QA:
    - Verify each of the issues in the RC are fixed  
3. Dev:  
    - Tag a new release (e.g. 1.1.1) and run an official build including code-signing
    - Publish the patch release in [GitHub repository](https://github.com/mattermost/desktop/releases) with SHA-256 checksums
    - Delete RCs after final version is shipped
    - Merge changes made to release branch into master
4. Release Manager:  
    - Update [Mattermost download page](https://mattermost.org/download)
    - Update the download links in [installation guides](https://docs.mattermost.com/install/desktop.html)
    - Update the changelog with notes on patch releases
    - Draft [Mattermost Security Updates](http://about.mattermost.com/security-updates/) if applicable, but do not post until seven days after official release
        - Check Security Issues spreadsheet and confirm disclosure text
5. Marketing:
    - Schedule Twitter announcement for 08:00 PST on the date of marketing announcement

### G. (T-minus 0 working days) Release Day

1. Release Manager:
    - Post this checklist in Desktop App channel
    - Verify all items in the last posted release checklist are complete
    - Add new release fix versions in Jira for the next few releases
    - Close the release in Jira
    - Post key dates for the next release in the header of the Desktop App channel and remove links to RC candidates
    - Check for any UserVoice feature suggestions that were completed in the current release
    - Confirm marketing has been posted
    - Close the release milestone in GitHub
2. Dev:
    - Delete RCs after final version is shipped    
    - Check if any libraries need to be updated for the next release

### H. (T-plus 10 working days) Release Updates

1. Release Manager:
    - Post this checklist in Desktop App channel
    - Post and review [Mattermost Security Updates](https://about.mattermost.com/security-updates/) for the Desktop App
    - Update Security Issues spreadsheet with issue number from posted update (e.g. v3.2.0.1)
    - Confirm the Security Researchers list on the [Responsible Disclosure Policy](https://www.mattermost.org/responsible-disclosure-policy/) is up to date
