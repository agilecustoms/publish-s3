# gha-upload-s3
GitHub Action to upload objects to Amazon S3  
Main features:
- Set content type (MIME type) to serve files from "web-site" bucket
- Add object tags. Primary usecase: Release=true, Release=false. Non release ones are cleanedup
- Ability to upload in several dirs, primarily to support "latest" directory - handy for development

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
      bucket: 'agilecustoms-tt-web-dist'
      bucket-dir: 1.1,latest
      tags: Release=true&Tag=1.1
```
