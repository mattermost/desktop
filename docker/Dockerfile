FROM suchja/wine:latest
MAINTAINER Yuya Ochiai <yuya0321@gmail.com>

ENV NODE_VERSION=v4.2.3
ENV PATH=$HOME/.nodebrew/current/bin:$PATH

USER root
RUN apt-get update && apt-get -y install wget bzip2 zip

USER xclient
# install Node.js
RUN curl -L git.io/nodebrew | perl - setup && nodebrew install-binary $NODE_VERSION && nodebrew use $NODE_VERSION
