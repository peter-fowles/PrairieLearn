FROM amazonlinux:2023
ARG CACHEBUST=2025-07-15-14-26-52

COPY plbase-install.sh python-requirements.txt /

RUN /bin/bash /plbase-install.sh

CMD [ "/bin/bash" ]
