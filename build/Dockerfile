# Defines an environment that contains everything necessary to build and sign mattermost-desktop releases
FROM ubuntu:17.10

# add wine repository
RUN apt-get update && apt-get install --no-install-recommends -y software-properties-common python-software-properties wget curl
RUN dpkg --add-architecture i386
RUN wget -nc https://dl.winehq.org/wine-builds/Release.key
RUN apt-key add Release.key
RUN apt-add-repository https://dl.winehq.org/wine-builds/ubuntu/

# add yarn repository
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list

# install prerequisites
RUN apt-get update && apt-get install --no-install-recommends -y git icnsutils graphicsmagick xz-utils jq winehq-stable mono-devel ca-certificates-mono gcc-multilib g++-multilib npm yarn

# Override the npm cache directory to avoid EACCES: permission denied, mkdir '/.npm'
# See https://stackoverflow.com/a/43264045/591374
# ENV npm_config_cache=npm-cache HOME=.
