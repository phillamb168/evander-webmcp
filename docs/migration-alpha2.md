# Moving from alpha.1 to alpha.2

The repository is now a workspace. Drupal source is under `integrations/drupal`,
shared browser/widget/React code under `packages`, and the optional backend under
`services/reference-backend`. Existing source-path imports must be updated; use
the named packages instead of reaching into another component's directories.

For Drupal, replace the installed module with the new release archive and run
`drush cr`. Configuration, plugin namespaces, hooks, tool IDs and version `1.0`
endpoints are unchanged. Node is still not required on the Drupal host. Do not
copy the unbuilt integration folder; use the archive or `dist/evander_webmcp`.

Use `TOOL_BASE_URL` for new backend configurations. The old `DRUPAL_TOOL_BASE`
setting continues to work, but conflicting values fail startup. The root
`npm run backend`, `npm run package` and `npm run verify` commands remain available.

GitHub supplies separate browser assets and JavaScript tarballs. Install all four
matching tarballs together when using React; package dependencies are not on npm.
The first alpha release and tag are unchanged. There is no WordPress plugin yet.
