# Release process

This package is published to npm by `.github/workflows/publish.yml`.

Publishing is triggered by publishing a GitHub Release. The workflow installs dependencies, builds the package, and runs:

```bash
pnpm publish --access public --no-git-checks
```

npm trusted publishing is configured for this package. The workflow has `id-token: write` permission so GitHub can issue
the short-lived identity token npm verifies during publish.

## Cut a release

1. Bump the version in `package.json` and merge that change to `main`.

2. Create a tag from `main` and publish a GitHub Release for it.

   ```bash
   git switch main
   git pull --ff-only origin main
   git tag -a vx.y.z -m "vx.y.z"
   git push origin vx.y.z
   gh release create vx.y.z --title "vx.y.z" --notes "Release notes"
   ```

3. Verify npm after the workflow finishes.

   ```bash
   npm view @psykhe-ai/browser-plugin-snowplow-ecommerce version
   ```

## Retry before npm publishes

If the GitHub Release workflow fails before npm publishes the version, delete the failed GitHub Release and tag, fix
`main`, then recreate the same tag and GitHub Release.

Do not reuse a version after npm has published it. npm package versions are immutable.
