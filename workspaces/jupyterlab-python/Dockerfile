FROM prairielearn/workspace-jupyterlab-base:latest
ARG CACHEBUST=2026-08-15-14-29-42

USER root
COPY install.sh requirements.txt /
RUN /bin/bash /install.sh

USER jovyan
