export interface R2Config {
    accountId: string
    accessKeyId: string
    secretAccessKey: string
    bucket: string
    sourceDir: string
    destinationDir: string
    outputFileUrl: boolean
    multiPartSize: number
    maxTries: number
    multiPartConcurrent: boolean
    keepFileFresh: boolean
}

export interface FileMap {
    [file: string]: string
}

export interface UploadResult<T extends object> {
    output: T
    url: string
}

export type UploadHandler<T extends object> = (file: string, config: R2Config) => Promise<UploadResult<T>>
