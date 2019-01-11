# Release Process

This document outlines the release process for the Mattermost Desktop App. It is drawn from the development process used by the [Mattermost core team](https://docs.mattermost.com/process/release-process.html).

## Release Timeline

Notes:
- All cut-off dates are based on 15:00 GMT (UTC-00) on the day stated. 
- T-minus counts are measured in "working days" (weekdays other than major holidays concurrent in US and Canada) prior to release day.

### A. (Code complete date of previous release) Beginning of release

Pre-work for the current release begins at the code complete date of the previous release. See "Code Complete and Release Candidate Cut" section below for details.

### B. (T-minus 12 working days) Release Date Announcement

1. PM:
    - Post this checklist in Desktop App channel
    - Confirm date of marketing announcement for the release and update Desktop App channel header if needed
    - Create meta issue for release in GitHub to let contributors and users know about the upcoming release. See [example issue](https://github.com/mattermost/desktop/issues/271).
    - Prepare JIRA tickets for the next release, with a corresponding vX.X prefix
        - Cut the release candidate (RC1)
        - Cut final release with code-signing for Windows and Mac builds
    - Queue desktop app for a 15-minute team testing
2. Dev/PM:
    - Prioritize reviewing, testing, and merging of pull requests for current release until there are no more tickets in the [pull request queue](https://github.com/mattermost/desktop/pulls) marked for the current release

### C. (T-minus 7 working days) Code Complete and Release Candidate Cut

**Stabilization** period begins when all features for release have been committed. During this period, only **bugs** can be committed to the release branch. Non-bug pull requests are tagged for the next version.

1. PM:
    - Post this checklist in Desktop App channel
    - Verify all items in the last posted release checklist are complete
    - Mail out mugs to any new contributors
    - Coordinate testing:  
        - Update the RC Testing Spreadsheet to cover any changes or new features, confirm that known issues are listed in the relevant tests, and assign each area to a team member
        - Post in Desktop App channel alerting community of upcoming release and to ask help with testing the release candidate
    - Update meta issue for release in GitHub with a link to the changelog
2. Dev/PM:
    - Submit changelog with updates for improvements, bug fixes, known issues, and contributors
    - Finalize roadmap for next release
3. Build:
    - Verify `version` in [package.json](https://github.com/mattermost/desktop/blob/master/package.json) and [src/package.json](https://github.com/mattermost/desktop/blob/master/src/package.json) are updated to the new release version
    - Master is tagged and branched and "Release Candidate 1" is cut (e.g. 1.1.0-RC1)
4. Marketing:
    - Tweet announcement that RC1 is ready
    - Queue art work for Twitter announcement

### D. (T-minus 6 working days) Release Candidate Testing

1. PM:
    - Post this checklist in Desktop App channel
    - Verify all items in the last posted release checklist are complete
    - Update Desktop App channel header with links to RC instances and testing spreadsheet
    - Post release testing instructions to Desktop App channel with a list of known issues
2. Team:
    - Test assigned areas of the Release Candidate Testing spreadsheet
3. Dev/PM:
    - Daily triage of hotfix candidates and decide whether and when to cut next RC or final
    - Post links to final tickets for next RC to the Desktop App channel
    - Submit PRs for hotfixes against the release branch, and review, test and merge prior to next RC
4. Build:
    - Push next RC to acceptance and announce in Desktop App channel with new RC link
5. PM:
    - Test the new RC to verify fixes merged to the release branch work and post in Desktop App channel after testing
    - Update the meta issue with download links to the new RCs and a list of approved fixes

### E. (T-minus 4 working days) Release Candidate Testing Finished

1. PM:
    - Post this checklist in Desktop App channel
    - Verify all items in the last posted release checklist are complete
    - Check that the following are updated in the Changelog:
        - Known issues
        - Contributors
        - Release candidate bug reports
2. Dev/PM:
    - Finish assigned areas of the Release Candidate Testing spreadsheet
    - Continue triaging hotfix candidates and decide on whether and when to cut next RC or final
    - If no blocking issues are found sign off on the release
3. Marketing:
    - Finish drafts of art work for Twitter announcement and send to marketing lead for review

### F. (T-minus 2 working days) Release Build Cut

The final release is cut. If an urgent and important issue needs to be addressed between major releases, a bug fix release (e.g. 1.1.1) may be created.

1. PM:
    - Post this checklist in Desktop App channel
    - Verify all items in the last posted release checklist are complete
2. Build:
    - Tag a new release (e.g. 1.1.0) and run an official build which should be essentially identical to the last RC
    - Post in Desktop App channel with links to all supported distributions and SHA-256 checksum
    - Complete code-signing and confirm that it worked well by testing the download links and keeping an eye out for any warnings or issues. Also, use these commands to verify the signatures:
      - Windows: On "Developer Command Prompt" (bundled in Visual Studio),
      `signtool verify /pa /all EXE_TO_VERIFY`
      - Mac: On console,
      `codesign --verify --deep --strict --verbose=2 Mattermost.app`
3. PM:
    - Update the links in [Mattermost download page](https://www.mattermost.org/download/) and [installation guides](https://docs.mattermost.com/install/desktop.html)
    - Draft [Mattermost Security Updates](http://about.mattermost.com/security-updates/) if applicable, but do not post until seven days after official release
        - Check Security Issues spreadsheet and confirm disclosure text
    - Contact owners of [community installers](http://www.mattermost.org/installation/) to update install version number
    - Close GitHub meta ticket for the release
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
2. PM:
    - Verify each of the issues in the RC are fixed  
3. Dev:  
    - Tag a new release (e.g. 1.1.1) and run an official build including code-signing
    - Publish the patch release in [GitHub repository](https://github.com/mattermost/desktop/releases) with SHA-256 checksums
    - Delete RCs after final version is shipped
    - Merge changes made to release branch into master
4. PM:  
    - Update [Mattermost download page](https://mattermost.org/download)
    - Update the download links in [installation guides](https://docs.mattermost.com/install/desktop.html)
    - Update the changelog with notes on patch releases (see [example entry](https://docs.mattermost.com/help/apps/desktop-changelog.html#release-v3-4-1))  
    - Draft [Mattermost Security Updates](http://about.mattermost.com/security-updates/) if applicable, but do not post until seven days after official release
        - Check Security Issues spreadsheet and confirm disclosure text
    - Contact owners of [community installers](http://www.mattermost.org/installation/) to update install version number
5. Marketing:
    - Schedule Twitter announcement for 08:00 PST on the date of marketing announcement

### G. (T-minus 0 working days) Release Day

1. PM:
    - Post this checklist in Desktop App channel
    - Verify all items in the last posted release checklist are complete
    - Post key dates for the next release in the header of the Desktop App channel and remove links to RC candidates
    - Confirm marketing has been posted
    - Close the release milestone in GitHub
2. Dev:
    - Delete RCs after final version is shipped    
    - Check if any libraries need to be updated for the next release

### H. (T-plus 10 working days) Release Updates

1. PM:
    - Post this checklist in Desktop App channel
    - Verify all items in the last posted release checklist are complete
    - Post and review [Mattermost Security Updates](https://about.mattermost.com/security-updates/) for the Desktop App
    - Update Security Issues spreadsheet with issue number from posted update (e.g. v3.2.0.1)
    - Confirm the Security Researchers list on the [Responsible Disclosure Policy](https://www.mattermost.org/responsible-disclosure-policy/) is up to date
    - Review community installers for the Desktop App and update version numbers if there are any discrepancies https://www.mattermost.org/installation/
