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

# Override the npm cache directory to avoid EACCES: permission denied, mkdir '/.npm'
# See https://stackoverflow.com/a/43264045/591374
#ENV npm_config_cache=npm-cache HOME=.

# increase the npm log level in hopes of getting some insight into what's going wrong
ENV npm_config_loglevel=verbose

# create and grant access to directories used by the build process
RUN mkdir /.npm && chmod 777 /.npm
RUN mkdir /.cache && chmod 777 /.cache
