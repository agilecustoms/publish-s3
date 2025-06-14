# gha-upload-s3
GitHub Action to upload objects to Amazon S3
As of Jan 2025 used only in "gha-release" custom GH action as part of release process 

Main features:
- Set content type (MIME type) to serve files from "web-site" bucket
- Add object tags. Primary usecase: Release=true, Release=false. Non-release ones can be deleted after 30 days
- Ability to upload in several dirs, primarily to support "latest" directory - handy for development
- to avoid clutter, the "latest" directory first cleaned up, and then files uploaded

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
