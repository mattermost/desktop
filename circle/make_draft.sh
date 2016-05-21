#!/bin/sh
set -ex
wget -q https://github.com/aktau/github-release/releases/download/v0.6.2/linux-amd64-github-release.tar.bz2
tar jxvf linux-amd64-github-release.tar.bz2
GITHUB_RELEASE=`pwd`/bin/linux/amd64/github-release
RELEASE_TAG=${CIRCLE_TAG#v}

upload()
{
  NAME=$1
  FILE=$2
  $GITHUB_RELEASE upload --user $CIRCLE_PROJECT_USERNAME --repo $CIRCLE_PROJECT_REPONAME --tag $CIRCLE_TAG --name \"$NAME\" --file $FILE
}

make_archive()
{
  OLDDIR=`pwd`
  ARCH=$1
  ARCHIVE_FORMAT=$2
  case "$ARCH" in
    "win64" ) cp -r release/windows-installer /tmp/mattermost-desktop-$RELEASE_TAG-$ARCH ;;
     "*" ) cp -r release/mattermost-desktop-$ARCH /tmp/mattermost-desktop-$RELEASE_TAG-$ARCH ;;
  esac
  cd /tmp
  case "$ARCHIVE_FORMAT" in
    "zip" ) zip -9 -r mattermost-desktop-$RELEASE_TAG-$ARCH.zip mattermost-desktop-$RELEASE_TAG-$ARCH ;;
    "tar.gz" ) tar zcvf mattermost-desktop-$RELEASE_TAG-$ARCH.tar.gz mattermost-desktop-$RELEASE_TAG-$ARCH ;;
  esac
  cd $OLDDIR
}

deploy()
{
  ARCH=$1
  ARCHIVE_FORMAT=$2
  case "$ARCHIVE_FORMAT" in
    "zip"|"tar.gz" ) make_archive $ARCH $ARCHIVE_FORMAT ;;
    "*" ) echo "Invalid ARCHIVE_FORMAT: $ARCHIVE_FORMAT" && exit 1 ;;
  esac
  FILE=mattermost-desktop-$RELEASE_TAG-$ARCH.$ARCHIVE_FORMAT
  upload "$FILE" /tmp/$FILE
}

$GITHUB_RELEASE release --user $CIRCLE_PROJECT_USERNAME --repo $CIRCLE_PROJECT_REPONAME --tag $CIRCLE_TAG --draft

deploy win64 zip
deploy osx tar.gz
deploy linux-ia32 tar.gz
deploy linux-x64 tar.gz
upload mattermost-desktop-$RELEASE_TAG-i386 release/mattermost-desktop-$RELEASE_TAG-i386.deb
upload mattermost-desktop-$RELEASE_TAG-amd64 release/mattermost-desktop-$RELEASE_TAG-amd64.deb
