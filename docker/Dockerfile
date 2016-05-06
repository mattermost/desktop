FROM suchja/wine:latest
MAINTAINER Yuya Ochiai <yuya0321@gmail.com>

ENV NODE_VERSION=v5.10.0
ENV PATH=$HOME/.nodebrew/current/bin:$PATH

USER root
RUN apt-get update && apt-get -y install wget bzip2 zip

# electron-builder
RUN apt-get update && apt-get -y install ruby ruby-dev gcc make icnsutils graphicsmagick xz-utils && gem install fpm

USER xclient
# install Node.js
RUN curl -L git.io/nodebrew | perl - setup && nodebrew install-binary $NODE_VERSION && nodebrew use $NODE_VERSION
