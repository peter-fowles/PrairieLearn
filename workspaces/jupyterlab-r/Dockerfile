FROM prairielearn/workspace-jupyterlab-base:latest
ARG CACHEBUST=2026-06-15-18-43-41

USER root
COPY install.sh requirements.txt /
RUN /bin/bash /install.sh

USER jovyan

# Tell Jupyter to hide the Python kernel
ENV HIDE_PYTHON_KERNEL=true
