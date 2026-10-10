FROM ghcr.io/railwayapp-templates/postgres-ssl:18.6

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends age python3 python3-boto3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

USER postgres
ENTRYPOINT ["python3"]
CMD ["/scripts/backup.py"]
