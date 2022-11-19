# r2-upload-action
GitHub Action to upload files to a Cloudflare R2 bucket, built on top of @aws-sdk/client-s3 in TypeScript.
<br>
Combination of these two repos: [S3 Upload Action](https://github.com/hkusu/s3-upload-action) and [Cloudflare R2 Upload](https://github.com/Karbust/Cloudflare_R2_Upload).

<!-- ACTION USAGE -->
## Usage

<!-- BASIC USAGE -->
### Basic Usage
```yaml
- uses: elementemerald/r2-upload-action@v1.0.5
  with:
    r2-account-id: ${{ secrets.R2_ACCOUNT_ID }}
    r2-access-key-id: ${{ secrets.R2_ACCESS_KEY_ID }}
    r2-secret-access-key: ${{ secrets.R2_SECRET_ACCESS_KEY }}
    r2-bucket: ${{ secrets.R2_BUCKET }}
    source-dir: src/
```
<!-- -->

<!-- ACTION INPUTS -->
## Inputs

| Name | Description | Default |
| --- | --- | --- |
| `r2-account-id` | **(Required)** Your Cloudflare account ID. | *N/A* |
| `r2-access-key-id` | **(Required)** Your Cloudflare R2 bucket access key ID. | *N/A* |
| `r2-secret-access-key` | **(Required)** Your Cloudflare R2 bucket secret access key. | *N/A* |
| `r2-bucket` | **(Required)** Your Cloudflare R2 bucket name. | *N/A* |
| `source-dir` | **(Required)** The directory to upload to the Cloudflare R2 bucket. | *N/A* |
| `destination-dir` | (Optional) The destination to upload the directory to in the Cloudflare R2 bucket. | Empty string |

<!-- ACTION OUTPUTS -->
## Outputs

| Name | Description |
| --- | --- |
| `result` | Result of this action. Either `success` or `failure` is set. |
| `file-urls` | The URLs of the uploaded files in the directory. |

<!-- CONTRIBUTING -->
## Contributing

See the [contributing guide](https://github.com/elementemerald/r2-upload-action/blob/readme-refactor/CONTRIBUTING.md) for more detail on how to implement something into the project.