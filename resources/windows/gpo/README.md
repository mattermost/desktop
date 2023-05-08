# Developer guide for using Group Policy Objects (GPO) (Windows 10 Pro)

GPOs are used to pre-configure servers, autoUpdater and server management

You can read more about GPOs [here](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/policy/group-policy-objects)

## How to use them on your windows machine for development

1. Copy the files from this directory (`resources/windows/gpo`) to `C:\Windows\PolicyDefinitions` - the file `mattermost.admx` should go in `C:\Windows\PolicyDefinitions` and the file `mattermost.adml` should go in `C:\Windows\PolicyDefinitions/en-US`.
2. Press `Win` + `R` to open the "Run" box
3. Type `gpedit.msc` to open the Group Policy Editor
4. Select "Administrative Templates" => "Mattermost" - either in "Computer Configuration" or "User Configuration" it shouldn't matter.
5. On the right side panel Select the Policy you want to update, eg, "DefaultServerList" then click the "Edit policy setting" hyperlink/button.
6. Select the "Enabled" radio checkbox and click the "Show" button under Options.
7. A new windows opens where you can add Multiple values for pre-configured servers, where `value name` is the Server Name and `value` is the Server URL.
Example:   

| Value Name | Value                            |
|------------|----------------------------------|
| Community  | <https://community.mattermost.com> |
8. Now if you open your Mattermost desktop application you should be able to see the server in the server dropdown

---

### Windows 10 Home:
The `gpedit.msc` is not available for the Home edition but, there is an open-source tool called [Policy Plus](https://github.com/Fleex255/PolicyPlus) that can help with that.
