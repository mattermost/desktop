# Defines an environment that contains everything necessary to build and sign mattermost-desktop releases
FROM ubuntu:17.10

# add wine repository
RUN apt-get update && apt-get install --no-install-recommends -y software-properties-common python-software-properties wget curl
RUN dpkg --add-architecture i386
RUN wget -nc https://dl.winehq.org/wine-builds/Release.key
RUN apt-key add Release.key
RUN apt-add-repository https://dl.winehq.org/wine-builds/ubuntu/

# install prerequisites
RUN apt-get update && apt-get install --no-install-recommends -y git icnsutils graphicsmagick xz-utils jq winehq-stable mono-devel ca-certificates-mono gcc-multilib g++-multilib npm

# increase the npm log level in hopes of getting some insight into what's going wrong
ENV npm_config_loglevel=verbose

# create and grant access to directories used by the build process
# this is necessary because npm is executed by root. alternatively, we could su jenkins before install. See https://stackoverflow.com/a/46922630/591374
# doing so would also avoid re-downloading the entire npm cache every time the build runs, because the jenkins user's home directory is mapped to a docker volume
RUN mkdir /.npm && chmod 777 /.npm
RUN mkdir /.cache && chmod 777 /.cache
