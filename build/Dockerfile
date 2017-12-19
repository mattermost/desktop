# Defines an environment that contains everything necessary to build and sign mattermost-desktop releases
FROM ubuntu:17.10

RUN apt-get update && apt-get install --no-install-recommends -y software-properties-common python-software-properties wget
RUN dpkg --add-architecture i386
RUN wget -nc https://dl.winehq.org/wine-builds/Release.key
RUN apt-key add Release.key
RUN apt-add-repository https://dl.winehq.org/wine-builds/ubuntu/

RUN apt-get update && apt-get install --no-install-recommends -y git icnsutils graphicsmagick xz-utils jq winehq-stable mono-devel ca-certificates-mono gcc-multilib g++-multilib npm
RUN unset DISPLAY && wineboot --init
