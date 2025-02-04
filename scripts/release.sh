#!/usr/bin/env bash

# exit when any command fails
set -e

function print_error {
    echo -e "[ERROR  ] $*"
}
function print_warning {
    echo -e "[WARNING] $*"
}
function print_info {
    echo -e "[INFO   ] $*"
}

function tag {
    # not forcing tags, this might fail on purpose if tags are already created
    # as we don't want to overwrite automatically.
    # if this happens, you should check that versions are ok and see if there are
    # any tags locally or upstream that might conflict.
    git tag -a "v${1}" -m "Desktop Version ${2}"
}

function write_package_version {
    temp_file="$(mktemp -t package.json.XXXX)"
    jq ".version = \"${1}\"" ./package.json > "${temp_file}" && mv "${temp_file}" ./package.json
    temp_file="$(mktemp -t package-lock.json.XXXX)"
    jq ".version = \"${1}\"" ./package-lock.json > "${temp_file}" && mv "${temp_file}" ./package-lock.json

    git add ./package.json ./package-lock.json
    git commit -qm "Bump to version ${1}"
}


# keep track of the last executed command
# src.: https://stackoverflow.com/a/6110446/3514658
trap 'last_command=$current_command; current_command=$BASH_COMMAND' DEBUG
# echo an error message before exiting
trap 'echo "\"${last_command}\" command filed with exit code $?."' EXIT

# mattermost repo might not be the origin one, we don't want to enforce that.
org="github.com:mattermost|https://github.com/mattermost"
git_origin="$(git remote -v | grep -E ${org} | grep push | awk '{print $1}')"
if [[ -z "${git_origin}" ]]; then
    print_warning "Can't find a mattermost remote, defaulting to origin"
    git_origin="origin"
fi

# get original git branch
branch_name="$(git symbolic-ref -q HEAD)"
branch_name="${branch_name##refs/heads/}"
branch_name="${branch_name:-HEAD}"

# don't run if branch is dirty, releases shouldn't be done on a dirty branch
dirty="$(git diff --quiet && echo 0 || echo 1)"
if (( dirty == 1 )); then
    print_error "Please use this script on a clean branch"
    exit 10
fi

# require jq
if ! type jq >/dev/null 2>&1; then
    print_error "This script requires jq to run"
    exit 11
fi

is_esr="N"
electron_upgrade="N"
# get version
pkg_version="$(jq -r .version package.json)"
# remove trailing
current_version="${pkg_version%-develop.*}"
current_version="${current_version%-rc.*}"
# parse version
IFS='.' read -r major minor micro <<<"${current_version}"
case "${1}" in
    "start")
        if [[ "${branch_name}" =~ "release-" ]]; then
            if [[ "${pkg_version}" =~ "-rc." ]]; then
                print_error "Can't generate a new release on a branch with a release candidate"
                exit 2
            fi
            print_info "Generating ${current_version} release candidate 1"
            read -p "Is this an ESR release? [y/N]: " is_esr
            if [[ "${is_esr}" =~ ^[Yy]$ ]]; then
                touch .esr
                git add .esr
            fi
            read -p "Did you upgrade to the latest stable Electron release? [y/N]: " electron_upgrade
            if [[ ! "${electron_upgrade}" =~ ^[Yy]$ ]]; then
                print_info "Please upgrade to the latest stable Electron release before continuing"
                exit 2
            fi
            new_pkg_version="${current_version}-rc.1"
            write_package_version "${new_pkg_version}"
            tag "${new_pkg_version}" "Release candidate 1"
            print_info "Locally created an new release with rc.1. In order to build you'll have to:"
            print_info "$ git push --follow-tags ${git_origin} ${branch_name}:${branch_name}"
            print_info "--------\n"
            print_info "  == REMINDER == "
            print_info "Don't forget to go and update the master branch to the next release version!"
        else
            print_error "Can't generate a release on a non release-X.Y branch"
            exit 2
        fi
    ;;
    "rc")
        if [[ "${branch_name}" =~ "release-" ]]; then
            if [[ "${pkg_version}" =~ "-rc." ]]; then
                rc="${pkg_version#*-rc.}"
            else
                print_error "No release candidate on the version, if this is a new release, start a new release first"
                exit 2
            fi
            case "${rc}" in
                ''|*[!0-9]*)
                    print_error "No release candidate on the version, if this is a new release, start a new release first"
                    exit 2
                ;;
                *)
                    rc=$(( rc + 1 ))
                ;;
            esac
            print_info "Generating ${current_version} release candidate ${rc}"
            new_pkg_version="${current_version}-rc.${rc}"
            write_package_version "${new_pkg_version}"
            tag "${new_pkg_version}" "Release candidate ${rc}"
            print_info "Locally created an rc. In order to build you'll have to:"
            print_info "$ git push --follow-tags ${git_origin} ${branch_name}:${branch_name}"
        else
            print_error "Can't generate a release candidate on a non release-X.Y branch"
            exit 2
        fi
    ;;
    "pre-final")
        if [[ "${branch_name}" =~ "release-" ]]; then
            print_info "Releasing v${current_version} for MAS approval"
            new_pkg_version="${current_version}"
            if [[ "${pkg_version}" != "${new_pkg_version}" ]]; then
                write_package_version "${new_pkg_version}"
            fi
            new_tag_version=$(git describe --match "v$current_version*" --abbrev=0)
            if [[ "${new_tag_version}" =~ "-mas." ]]; then
                mas="${new_tag_version#*-mas.}"
            else
                mas=0
            fi
            case "${mas}" in
                ''|*[!0-9]*)
                    mas=0
                ;;
                *)
                    mas=$(( mas + 1 ))
                ;;
            esac
            tag "${new_pkg_version}-mas.${mas}" "MAS approval ${mas}"
            print_info "Locally created an MAS approval version. In order to build you'll have to:"
            print_info "$ git push --follow-tags ${git_origin} ${branch_name}:${branch_name}"
        else
            print_error "Can't release on a non release-X.Y branch"
            exit 2
        fi
    ;;
    "final")
        if [[ "${branch_name}" =~ "release-" ]]; then
            print_info "Releasing v${current_version}"
            new_pkg_version="${current_version}"
            if [[ "${pkg_version}" != "${new_pkg_version}" ]]; then
                write_package_version "${new_pkg_version}"
            fi
            tag "${new_pkg_version}" "Released on $(date -u)"
            print_info "Locally created an final version. In order to build you'll have to:"
            print_info "$ git push --follow-tags ${git_origin} ${branch_name}:${branch_name}"
            print_info "--------\n"
            print_info "  == AFTER RELEASE FINISHES == "
            print_info "once the release is created you'll need to go to latest/.gitlab-ci.yml"
            print_info "and update the latest version variables for the desktop,"
            print_info "run the the pipeline and from the list of jobs run the desktop one"
        else
            print_error "Can't release on a non release-X.Y branch"
            exit 2
        fi
    ;;
    "patch")
        if [[ "${branch_name}" =~ "release-" ]]; then
            new_pkg_version="${major}.${minor}.$(( micro + 1 ))-rc.1"
            print_info "Releasing v${new_pkg_version}"
            write_package_version "${new_pkg_version}"
            tag "${new_pkg_version}" "Released on $(date -u)"
            print_info "Locally created an patch version. In order to build you'll have to:"
            print_info "$ git push --follow-tags ${git_origin} ${branch_name}:${branch_name}"
        else
            print_error "Can't patch on a non release-X.Y branch"
            exit 2
        fi
    ;;
    *)
        print_info "Mattermmost Desktop Release Helper"
        print_info "Usage: $0 <start|rc|pre-final|final|patch>\n"
        print_info "This script will help you create a new release for the Mattermost Desktop App."
        print_info "Must be run on a release branch (release-X.Y)\n"
        print_info "Commands:"
        print_info "  start: Start a new release using the current version"
        print_info "  rc: Increment the release candidate version and create a new release candidate"
        print_info "  pre-final: Cut the final release for MAS approval"
        print_info "  final: Cut the final release to be released to GitHub"
        print_info "  patch: Create a patch (dot) release"
        exit 1
    ;;
esac

trap - EXIT

