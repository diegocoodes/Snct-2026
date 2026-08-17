#!/usr/bin/env bash
# Aplica proxy WebSocket no vhost SSL do SNCT (requer sudo).
set -euo pipefail

TARGET=/etc/apache2/sites-available/snct.kaiolimapimentel.com.br-le-ssl.conf

sudo tee "$TARGET" > /dev/null << 'EOF'
<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName snct.kaiolimapimentel.com.br

    ProxyRequests Off
    ProxyPreserveHost On
    ProxyTimeout 120

    RequestHeader set X-Forwarded-Proto "expr=%{REQUEST_SCHEME}"
    RequestHeader set X-Forwarded-Port "expr=%{SERVER_PORT}"

    ProxyPass /.well-known/acme-challenge/ !
    Alias /.well-known/acme-challenge/ /var/www/html/.well-known/acme-challenge/
    <Directory "/var/www/html/.well-known/acme-challenge/">
        Options None
        AllowOverride None
        Require all granted
    </Directory>

    ProxyPass        /ws/ ws://127.0.0.1:4101/ws/ timeout=3600 connectiontimeout=15 retry=0
    ProxyPassReverse /ws/ ws://127.0.0.1:4101/ws/

    ProxyPass        /api/ http://127.0.0.1:4101/api/ timeout=120 connectiontimeout=15 retry=0
    ProxyPassReverse /api/ http://127.0.0.1:4101/api/
    ProxyPass        /api http://127.0.0.1:4101/api timeout=120 connectiontimeout=15 retry=0
    ProxyPassReverse /api http://127.0.0.1:4101/api

    ProxyPass        / http://127.0.0.1:4100/ timeout=120 connectiontimeout=15 retry=0
    ProxyPassReverse / http://127.0.0.1:4100/

    ErrorLog ${APACHE_LOG_DIR}/snct.kaiolimapimentel.com.br-error.log
    CustomLog ${APACHE_LOG_DIR}/snct.kaiolimapimentel.com.br-access.log combined

SSLCertificateFile /etc/letsencrypt/live/snct.kaiolimapimentel.com.br/fullchain.pem
SSLCertificateKeyFile /etc/letsencrypt/live/snct.kaiolimapimentel.com.br/privkey.pem
Include /etc/letsencrypt/options-ssl-apache.conf
</VirtualHost>
</IfModule>
EOF

sudo apache2ctl configtest
sudo systemctl reload apache2
echo "Proxy /ws/ aplicado no SSL e Apache recarregado."
