# R2 Upload Action
GitHub Action to upload files to a Cloudflare R2 bucket, built on top of @aws-sdk/client-s3 in TypeScript.
<br>
Combination of these two repos: [S3 Upload Action](https://github.com/hkusu/s3-upload-action) and [Cloudflare R2 Upload](https://github.com/Karbust/Cloudflare_R2_Upload).

<!-- ACTION USAGE -->
## Usage

<!-- BASIC USAGE -->
### Basic Usage
```yaml
- uses: ryand56/r2-upload-action@v1.2
  with:
    r2-account-id: ${{ secrets.R2_ACCOUNT_ID }}
    r2-access-key-id: ${{ secrets.R2_ACCESS_KEY_ID }}
    r2-secret-access-key: ${{ secrets.R2_SECRET_ACCESS_KEY }}
    r2-bucket: ${{ secrets.R2_BUCKET }}
    source-dir: src
```

In this example, `source-dir` is stored in the root of the bucket.
Specify `destination-dir` input to change the location of where the directory will be uploaded.
<!-- -->

<!-- CUSTOM USAGE -->
### Custom Usage
```yaml
- uses: ryand56/r2-upload-action@v1.2
  with:
    r2-account-id: ${{ secrets.R2_ACCOUNT_ID }}
    r2-access-key-id: ${{ secrets.R2_ACCESS_KEY_ID }}
    r2-secret-access-key: ${{ secrets.R2_SECRET_ACCESS_KEY }}
    r2-bucket: ${{ secrets.R2_BUCKET }}
    source-dir: src
    destination-dir: artifacts # Can be anything as long as it is an actual path
    output-file-url: 'true' # defaults to true
```
See the latest [action.yml](https://github.com/ryand56/r2-upload-action/blob/master/action.yml) for every input and output or take a look below.
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

See the [contributing guide](https://github.com/ryand56/r2-upload-action/blob/master/CONTRIBUTING.md) for more detail on how to implement something into the project.