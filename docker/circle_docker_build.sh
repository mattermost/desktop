#!/bin/sh
# execute from source root
set -ex
CACHE_DIR=~/docker_cache
if [ -e ${CACHE_DIR}/em-builder.tar ] && md5sum -c ${CACHE_DIR}/dockerfile.md5sum
then
  docker load < ${CACHE_DIR}/em-builder.tar
else
  mkdir -p ${CACHE_DIR}
  docker build -t yuya-oc/em-builder docker
  md5sum docker/Dockerfile > ${CACHE_DIR}/dockerfile.md5sum
  docker save yuya-oc/em-builder > ${CACHE_DIR}/em-builder.tar
fi
