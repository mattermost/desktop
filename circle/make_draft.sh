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

make_zip()
{
  OLDDIR=`pwd`
  ARCH=$1
  cp -r release/mattermost-desktop-$ARCH /tmp/mattermost-desktop-$RELEASE_TAG-$ARCH
  cd /tmp
  zip -9 -r mattermost-desktop-$RELEASE_TAG-$ARCH.zip mattermost-desktop-$RELEASE_TAG-$ARCH
  cd $OLDDIR
}

make_tar_gz()
{
  OLDDIR=`pwd`
  ARCH=$1
  cp -r release/mattermost-desktop-$ARCH /tmp/mattermost-desktop-$RELEASE_TAG-$ARCH
  cd /tmp
  tar zcvf mattermost-desktop-$RELEASE_TAG-$ARCH.tar.gz mattermost-desktop-$RELEASE_TAG-$ARCH
  cd $OLDDIR
}

deploy()
{
  ARCH=$1
  ARCHIVE_FORMAT=$2
  case "$ARCHIVE_FORMAT" in
    "zip" ) make_zip $ARCH ;;
    "tar.gz" ) make_tar_gz $ARCH ;;
    "*" ) echo "Invalid ARCHIVE_FORMAT: $ARCHIVE_FORMAT" && exit 1 ;;
  esac
  FILE=mattermost-desktop-$RELEASE_TAG-$ARCH.$ARCHIVE_FORMAT
  upload "$FILE" /tmp/$FILE
}

$GITHUB_RELEASE release --user $CIRCLE_PROJECT_USERNAME --repo $CIRCLE_PROJECT_REPONAME --tag $CIRCLE_TAG --draft

deploy win32 zip
deploy win64 zip
deploy osx tar.gz
deploy linux-ia32 tar.gz
deploy linux-x64 tar.gz
upload mattermost-desktop-$RELEASE_TAG-linux-ia32.deb release/mattermost-desktop-$RELEASE_TAG-ia32.deb
upload mattermost-desktop-$RELEASE_TAG-linux-x64.deb release/mattermost-desktop-$RELEASE_TAG.deb
upload mattermost-setup-$RELEASE_TAG-win32.exe release/windows-installer-ia32/mattermost-setup-ia32.exe
upload mattermost-setup-$RELEASE_TAG-win64.exe release/windows-installer-x64/mattermost-setup-x64.exe
