FROM ubuntu:24.04

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG NODE_VERSION=24.16.0
ARG NVM_VERSION=0.40.3

ENV DEBIAN_FRONTEND=noninteractive
ENV NVM_DIR=/home/ubuntu/.nvm
ENV DISPLAY=:99
ENV ELECTRON_DISABLE_SANDBOX=1
ENV PATH=/home/ubuntu/.nvm/versions/node/v${NODE_VERSION}/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    apt-transport-https \
    bash \
    build-essential \
    ca-certificates \
    curl \
    dbus \
    dbus-x11 \
    git \
    gnupg \
    jq \
    libasound2t64 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpng++-dev \
    libsecret-1-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    libxtst-dev \
    locales \
    graphicsmagick \
    icnsutils \
    pkg-config \
    python3 \
    python3-pip \
    sudo \
    tzdata \
    unzip \
    x11-utils \
    xauth \
    xvfb && \
    locale-gen en_US.UTF-8 && \
    rm -rf /var/lib/apt/lists/*

RUN install -m 0755 -d /etc/apt/keyrings && \
    curl --retry 3 --retry-delay 5 -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends gh && \
    rm -rf /var/lib/apt/lists/*

RUN if ! id -u ubuntu >/dev/null 2>&1; then useradd -m -s /bin/bash ubuntu; fi && \
    echo "ubuntu ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/ubuntu && \
    chmod 0440 /etc/sudoers.d/ubuntu && \
    install -d -o ubuntu -g ubuntu "${NVM_DIR}"

RUN git clone --depth 1 --branch "v${NVM_VERSION}" https://github.com/nvm-sh/nvm.git "${NVM_DIR}" && \
    chown -R ubuntu:ubuntu "${NVM_DIR}" && \
    su ubuntu -c "bash -lc 'set -e; source ${NVM_DIR}/nvm.sh; nvm install ${NODE_VERSION}; nvm alias default ${NODE_VERSION}; nvm use default'" && \
    ln -sfn "${NVM_DIR}/versions/node/v${NODE_VERSION}/bin/node" /usr/local/bin/node && \
    ln -sfn "${NVM_DIR}/versions/node/v${NODE_VERSION}/bin/npm" /usr/local/bin/npm && \
    ln -sfn "${NVM_DIR}/versions/node/v${NODE_VERSION}/bin/npx" /usr/local/bin/npx

RUN { \
    echo 'export NVM_DIR="$HOME/.nvm"'; \
    echo '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"'; \
    echo 'export PATH="$NVM_DIR/versions/node/v24.16.0/bin:$PATH"'; \
    echo '[ -f "$HOME/.cloud-agent-env" ] && . "$HOME/.cloud-agent-env"'; \
    } >> /home/ubuntu/.bashrc && \
    chown ubuntu:ubuntu /home/ubuntu/.bashrc

ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

WORKDIR /home/ubuntu
USER ubuntu
