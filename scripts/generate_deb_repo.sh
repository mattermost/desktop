#!/usr/bin/env bash

set -e

# Variables
REPO_DIR=$1
PGP_KEY=$2
VERSION="$(jq -r '.version' <package.json)"
GNUPGHOME="$(mktemp -d ~/pgpkeys-XXXXXX)"

# Get the correct name for the deb repo
STABLE_VERSION="$(./node_modules/.bin/semver $VERSION -c)"
RELEASE_VERSION="${VERSION/$STABLE_VERSION/}"
RELEASE_VERSION="${RELEASE_VERSION/-/}"
RELEASE_VERSION="${RELEASE_VERSION%.*}"

case $RELEASE_VERSION in
    "rc")
        REPO_VERSION="testing"
        ;;
    "nightly")
        REPO_VERSION="unstable"
        ;;
    "")
        REPO_VERSION="stable"
        ;;
esac

if [ -z "$REPO_VERSION" ]; then
    echo "Incompatible version, exiting"
    exit 0
fi

if [ -z "${!PGP_KEY}" ]; then
    echo "Missing PGP key, exiting"
    exit 0
fi

# Functions
function do_hash {
    HASH_NAME=$1
    HASH_CMD=$2
    echo "${HASH_NAME}:"
    for f in $(find dists/$REPO_VERSION -type f); do
        if [ "$f" = "dists/$REPO_VERSION/Release" ]; then
            continue
        fi
        echo " $(${HASH_CMD} ${f} | cut -d" " -f1) $(wc -c $f | sed "s/dists\/$REPO_VERSION\///g")"
    done
}

function generate_release {
cat << EOF
Origin: Mattermost Desktop App
Label: Mattermost is an open source platform for secure collaboration across the entire software development lifecycle.
Suite: $REPO_VERSION
Codename: $REPO_VERSION
Version: $VERSION
Architectures: amd64 i386
Components: main
Description: Mattermost is an open source platform for secure collaboration across the entire software development lifecycle.
Date: $(date -Ru)
EOF
    do_hash "MD5Sum" "md5sum"
    do_hash "SHA1" "sha1sum"
    do_hash "SHA256" "sha256sum"
}

cd $REPO_DIR

# Make the directories
mkdir -p dists/$REPO_VERSION/main/binary-i386
mkdir -p dists/$REPO_VERSION/main/binary-amd64

# Scan packages
dpkg-scanpackages --arch i386 ${VERSION}/ > dists/$REPO_VERSION/main/binary-i386/Packages
dpkg-scanpackages --arch amd64 ${VERSION}/ > dists/$REPO_VERSION/main/binary-amd64/Packages

# Compress package files
cat dists/$REPO_VERSION/main/binary-i386/Packages | gzip -9 > dists/$REPO_VERSION/main/binary-i386/Packages.gz
cat dists/$REPO_VERSION/main/binary-amd64/Packages | gzip -9 > dists/$REPO_VERSION/main/binary-amd64/Packages.gz

# Generate Release file
generate_release >> dists/$REPO_VERSION/Release

# Sign Release File
echo "${!PGP_KEY}" | sed 's/:/\n/g' > ~/pgp-key.private
GNUPGHOME=$GNUPGHOME cat ~/pgp-key.private | gpg --import
GNUPGHOME=$GNUPGHOME cat dists/$REPO_VERSION/Release | gpg --default-key Mattermost -abs > dists/$REPO_VERSION/Release.gpg
GNUPGHOME=$GNUPGHOME cat dists/$REPO_VERSION/Release | gpg --default-key Mattermost -abs --clearsign > dists/$REPO_VERSION/InRelease

cd -
