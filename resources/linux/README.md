# Mattermost Desktop for Linux

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)


## Install

If you were installed the application via package managers, you don't have to do
anymore. It's ready to use in your system, so please follow [usage](#usage)
instruction.

First, locate the extracted directory into your desired directory (e.g.
`/opt/mattermost-desktop-<VERSION>`).


### Desktop launcher

Execute the script file to create `Mattermost.desktop` file.

```
/opt/mattermost-desktop-<VERSION>/create_desktop_file.sh
```

Then move it into appropreate directory of your desktop environment. For
example, it's `~/.local/share/applications/` for current user on Ubuntu Unity.

```
mv Mattermost.desktop ~/.local/share/applications/
```

### Terminal command

Set `PATH` environment variable to enable launching from terminal.
For example, you can append following line into `~/.bashrc`.

```sh
# assuming that /opt/mattermost-desktop-<VERSION>/mattermost-desktop is the executable file.
export PATH=$PATH:/opt/mattermost-desktop-<VERSION>
```

Alternatively, you can also create a symbolic link for the application.

```sh
sudo ln -s /opt/mattermost-desktop-<VERSION>/mattermost-desktop /usr/local/bin/
```

## Usage

After launching, you need to configure the application to interact with your team.

1. If you don't see "Settings" page, select **File** -> **Settings...** from the menu bar.
2. Click **Add new team** next to the right of Team Management section.
3. Enter **Name** and a valid **URL**, which begins with either `http://` or `https://`.
4. Click **Add**.


### More guides

Available at [Mattermost Documentation](https://docs.mattermost.com/help/apps/desktop-guide.html).


## Contributing

See [the contribute file](https://github.com/mattermost/desktop/blob/master/CONTRIBUTING.md).


## License

Apache Lisence, Version 2.0
