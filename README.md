# release-s3
GitHub Action to upload objects to Amazon S3
Intended to be used only in GH action `agilecustoms/release` as part of release process 

Main features:
- Set content type (MIME type) to serve files from "web-site" bucket
- Add object tags. Primary usecase: `Release=true`, `Release=false`. Non-release ones can be deleted after 30 days
- Ability to upload in several dirs to support semantic versioning: `/myservice/1.2.4`, `/myservice/1.2`, `/myservice/1`, `myservice/latest`
- To avoid clutter, the directories first cleaned up, and then files uploaded

## Usage
```yaml
steps:
  - name: Upload in S3
    uses: agilecustoms/release-s3@main
    with:
      access-key-id: ${{ steps.creds.outputs.aws-access-key-id }}
      secret-access-key: ${{ steps.creds.outputs.aws-secret-access-key }}
      session-token: ${{ steps.creds.outputs.aws-session-token }}
      bucket: 'mycompany-dist'
      bucker-dir: '' # bucket/bucket-dir/repo-name/version/{./s3 directory content}
      dev-release: false
      versions: 1.2.3,1.2,1,latest
```

If `dev-release` is true, then there should be exactly one version in `versions` parameter