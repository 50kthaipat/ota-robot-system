# Security policy

This repository is an experimental robot-fleet OTA platform, not a production-certified industrial control system. Do not expose the local Docker Compose stack to an untrusted network: it includes demo credentials, anonymous MQTT, and an anonymously accessible Grafana administrator role.

## Reporting a vulnerability

Please use GitHub's **Report a vulnerability** / private security advisory option on this repository if available. If it is not enabled, contact the repository maintainer privately; do not publish exploit details in an issue. Do not include passwords, private keys, tokens, or real device data in a report.

## Deployment expectations

- Set `APP_ENV=production` (or `ENV=production`) and provide unique database, JWT, admin, storage, MQTT, and ECDSA signing credentials through a secret manager.
- Use HTTPS/TLS for the dashboard, API, object storage, and MQTT. Restrict metrics and administrative consoles to trusted networks.
- Never deploy the demo `docker-compose.yml` configuration as-is to production.
- Keep `keys/private.pem` and `.env` out of Git; rotate any credential that has been exposed, including in Git history.
- Earlier commits contained an embedded example ECDSA private key. Treat that identity and firmware signed with it as untrusted; rotate the signing key and distribute its new public key to every device through a trusted channel before relying on signature verification. Removing it from the current source does not remove it from Git history.

The historical audit in [`security/audit_report.md`](security/audit_report.md) records findings as of September 11, 2026 and is not a current certification or a live GitHub alert report.
