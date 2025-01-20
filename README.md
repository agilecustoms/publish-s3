# gha-upload-s3
GitHub Action to upload objects to Amazon S3
As of Jan 2025 used only in "gha-release" custom GH action as part of release process 

Main features:
- Set content type (MIME type) to serve files from "web-site" bucket
- Add object tags. Primary usecase: Release=true, Release=false. Non release ones are cleaned up after 30 days (not part of this action)
- Ability to upload in several dirs, primarily to support "latest" directory - handy for development
- "latest" directory cleaned up first, to avoid clutter

## Usage
```yaml
steps:
  - name: Upload S3
    uses: agilecustoms/gha-upload-s3@main
    with:
      access-key-id: '${{ steps.creds.outputs.aws-access-key-id }}'
      secret-access-key: ${{ steps.creds.outputs.aws-secret-access-key }}
      session-token: ${{ steps.creds.outputs.aws-session-token }}
      source-dir: 'dist'
      bucket: 'agilecustoms-dist'
      bucket-dir: my-service/1.1,my-service/latest
      tags: Release=true&Tag=1.1
```
