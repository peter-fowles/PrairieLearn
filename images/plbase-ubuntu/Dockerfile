FROM ubuntu:22.04

# install.sh              - script to install everything (also used by production builds)
# python-requirements.txt - list of python packages to be installed by pip
COPY install.sh python-requirements.txt /

RUN /bin/bash /install.sh

CMD /bin/bash
