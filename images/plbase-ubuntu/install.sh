#!/bin/bash
set -ex

apt-get update
apt-get upgrade

DEBIAN_FRONTEND=noninteractive apt-get install -y curl

# Set up Node.
curl -sL https://deb.nodesource.com/setup_16.x -o /tmp/nodesource_setup.sh
bash /tmp/nodesource_setup.sh

DEBIAN_FRONTEND=noninteractive apt-get install -y \
  curl \
  dvipng \
  gcc \
  g++ \
  graphviz \
  imagemagick \
  libgraphviz-dev \
  libjpeg9-dev \
  make \
  nodejs \
  openssl \
  postgresql-14 \
  postgresql-contrib \
  procps \
  tar \
  texlive-base

echo "setting up conda..."
cd /
arch=`uname -m`
curl -LO https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-${arch}.sh
bash Miniforge3-Linux-${arch}.sh -b -p /usr/local -f

# If R package installation is specifically disabled, we'll avoid installing anything R-related.
if [[ "${SKIP_R_PACKAGES}" != "yes" ]]; then
    echo "installing R..."
    conda install --channel r r-base r-essentials

    echo "installing Python packages..."
    python3 -m pip install --no-cache-dir -r /python-requirements.txt
else
    echo "R package installation is disabled"
    sed '/rpy2/d' /python-requirements.txt > /py_req_no_r.txt # Remove rpy2 package.
    echo "installing Python packages..."
    python3 -m pip install --no-cache-dir -r /py_req_no_r.txt
fi
