FROM mcr.microsoft.com/devcontainers/base:trixie

RUN apt-get update && apt-get install -y --no-install-recommends xdg-utils nodejs
USER vscode

RUN curl -fsSL https://mise.run | sh \
    && echo 'eval "$(mise activate bash)"' >> ~/.bashrc \
    && echo 'eval "$(mise activate zsh)"' >> "${ZDOTDIR-$HOME}/.zshrc"
ENV PATH="/home/vscode/.vite-plus/bin:/home/vscode/.local/bin:${PATH}"
# RUN mise use -g opencode@latest "npm:btca@latest"
COPY mise.toml /tmp/mise.toml
RUN cd /tmp && mise trust && mise install -y
