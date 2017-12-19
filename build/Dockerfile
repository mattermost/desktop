# Defines an environment that contains everything necessary to build and sign mattermost-desktop releases
FROM ubuntu:17.10

# add wine repository
RUN apt-get update && apt-get install --no-install-recommends -y software-properties-common python-software-properties wget
RUN dpkg --add-architecture i386
RUN wget -nc https://dl.winehq.org/wine-builds/Release.key
RUN apt-key add Release.key
RUN apt-add-repository https://dl.winehq.org/wine-builds/ubuntu/

# install prerequisites
RUN apt-get update && apt-get install --no-install-recommends -y git icnsutils graphicsmagick xz-utils jq winehq-stable mono-devel ca-certificates-mono gcc-multilib g++-multilib npm

# TODO: this causes a bunch of errors because there's no x server running inside of docker - can we remove it?
#RUN unset DISPLAY && wineboot --init

# configure NPM to not need sudo
# see https://github.com/sindresorhus/guides/blob/master/npm-global-without-sudo.md
RUN mkdir "${HOME}/.npm-packages"
RUN echo "prefix=${HOME}/.npm-packages" > ~/.npmrc
ENV NPM_PACKAGES="${HOME}/.npm-packages"
ENV PATH="${NPM_PACKAGES}/bin:${PATH}"
ENV MANPATH="${NPM_PACKAGES}/share/man:$(manpath)"
