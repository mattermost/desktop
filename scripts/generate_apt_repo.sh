#!/usr/bin/env bash
set -xeuo pipefail

if [[ "${RELEASE}" != "bionic" && "${RELEASE}" != "focal" ]]; then
    printf "ERROR: unsupported release %q\n" "${RELEASE}" >&2
    exit 1
fi

if test -z "$REPO" 
then
    printf "ERROR: Please define REPO variable" >&2
    exit 2
fi

if test -z "$APT_REPO_URL" 
then
    printf "ERROR: Please define APT_REPO_URL variable" >&2
    exit 3
fi

aptly mirror create ${RELEASE}-mirror ${APT_REPO_URL} ${RELEASE}
aptly mirror update ${RELEASE}-mirror
aptly repo create -distribution=${RELEASE} ${RELEASE}-repo
aptly repo import ${RELEASE}-mirror ${RELEASE}-repo ${REPO}

if [[ "${MOD:-NIGHTLY}" == "NIGHTLY" ]]; then
    aptly repo remove ${RELEASE}-repo ${REPO}-nightly
    aptly repo add ${RELEASE}-repo artifacts/*.deb
else
    aptly repo add -force-replace ${RELEASE}-repo artifacts/*.deb
fi

aptly snapshot create ${RELEASE}-snapshot from repo ${release}-repo

# TODO: PUBLISH