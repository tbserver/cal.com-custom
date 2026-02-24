FROM calcom/cal.com:v6.1.16

# Install Doppler CLI for runtime secret injection
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
        apt-transport-https ca-certificates curl gnupg && \
    curl -sLf --retry 3 --tlsv1.2 --proto "=https" \
        'https://packages.doppler.com/public/cli/gpg.DE2A7741A397C129.key' \
        | gpg --dearmor -o /usr/share/keyrings/doppler-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/doppler-archive-keyring.gpg] https://packages.doppler.com/public/cli/deb/debian any-version main" \
        | tee /etc/apt/sources.list.d/doppler-cli.list && \
    apt-get update && apt-get install -y doppler && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Entrypoint script: maps CALCOM_* prefixed Doppler vars to what Cal.com expects
COPY entrypoint.sh /usr/local/bin/calcom-entrypoint.sh
RUN chmod +x /usr/local/bin/calcom-entrypoint.sh

# Doppler injects all tbserver secrets, then entrypoint maps CALCOM_* → native vars
ENTRYPOINT ["doppler", "run", "--"]
CMD ["calcom-entrypoint.sh"]
