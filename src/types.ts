export interface R2Config {
    accountId: string
    accessKeyId: string
    secretAccessKey: string
    bucket: string
    sourceDir: string
    destinationDir: string
    outputFileUrl: boolean
    customCharset: string
}

export interface FileMap {
    [file: string]: string
}