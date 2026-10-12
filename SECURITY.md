# Security and privacy boundaries

Report security issues privately to the repository maintainer. Do not publish
tokens, captured prompts or sensitive content in issues.

- Public, published content only; anonymous route, entity and field checks apply independently of the caller's login. Administrators explicitly allow tools and fields.
- Server tools are read-only; browser navigation is a separate action. Links are offered for user activation. Opening an external booking site is not an appointment or medical triage.
- Trusted Drupal modules/plugins remain trusted server code. Do not install an unreviewed plugin merely because it has read-only annotations.
- Configure Drupal `trusted_host_patterns`, HTTPS, reverse-proxy settings and deployment-specific rate limiting. A public site ID and CORS/Origin checks are not secrets or bot protection.
- Search fields, rendered formatters, site visibility extensions and custom blocks need site-specific access tests. The API does not promise visibility identical to every theme's CSS or client-side conditional rendering.
- The reference backend accepts only its configured site, never a caller-supplied upstream URL. Tool results and page text are untrusted model input. Model-generated tools and source IDs are validated; arbitrary model-authored URLs and prose are not rendered.
- Logs are metadata-only. Prompts and tool results still travel to the configured inference provider; obtain appropriate notice/consent and review provider retention policies before enabling chat. Do not enter personal, patient or sensitive information.
- The reference server's in-memory sessions and per-instance limits are for evaluation, not a distributed production deployment. No endpoint should be exposed publicly without an operator's security review.
- Back up configuration before changes. Disabling the backend removes chat without disabling Drupal-hosted WebMCP. Disabling the module removes both.
