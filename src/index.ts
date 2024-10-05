import { R2Config, FileMap, UploadHandler } from "./types.js";
import { getInput, setOutput, setFailed } from "@actions/core";
import {
    S3Client,
    PutObjectCommandInput,
    PutObjectCommand,
    PutObjectCommandOutput,
    S3ServiceException,
    CompleteMultipartUploadCommand,
    CompleteMultipartUploadCommandInput,
    UploadPartCommandInput,
    AbortMultipartUploadCommand,
    AbortMultipartUploadCommandInput,
    CreateMultipartUploadCommand,
    CreateMultipartUploadCommandInput,
    UploadPartCommand,
    CompleteMultipartUploadCommandOutput,
    ListObjectsV2Command,
    DeleteObjectsCommand,
    DeleteObjectsCommandInput
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as fs from "fs";
import mime from "mime";
import md5 from "md5";
import path from "path";
import { formatBytes, formatFileSize, getFileList, getFileSizeMB, readFixedChunkSize, sleep } from "./utils.js";

let config: R2Config = {
    accountId: getInput("r2-account-id", { required: true }),
    accessKeyId: getInput("r2-access-key-id", { required: true }),
    secretAccessKey: getInput("r2-secret-access-key", { required: true }),
    bucket: getInput("r2-bucket", { required: true }),
    jurisdiction: getInput("r2-jurisdiction"),
    sourceDir: getInput("source-dir", { required: true }),
    destinationDir: getInput("destination-dir"),
    outputFileUrl: getInput("output-file-url") === 'true',
    multiPartSize: parseInt(getInput("multipart-size")) || 100,
    maxTries: parseInt(getInput("max-retries")) || 5,
    multiPartConcurrent: getInput("multipart-concurrent") === 'true',
    keepFileFresh: getInput("keep-file-fresh") === 'true',
    customCharset: getInput("custom-charset")
};

const S3 = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.${config.jurisdiction != "" ? config.jurisdiction + "." : ""}r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
    },
});

const deleteRemoteFiles = async (bucket: string, prefix: string) => {
    try {
        const listParams = {
            Bucket: bucket,
            Prefix: prefix
        };
        
        const listedObjects = await S3.send(new ListObjectsV2Command(listParams));
        
        if (listedObjects.Contents && listedObjects.Contents.length > 0) {
            const deleteParams: DeleteObjectsCommandInput = {
                Bucket: bucket,
                Delete: {
                    Objects: listedObjects.Contents.map(({ Key }) => ({ Key })),
                    Quiet: true
                }
            };

            await S3.send(new DeleteObjectsCommand(deleteParams));
            console.log(`Deleted all objects under ${prefix}`);
        }
    } catch (err) {
        console.error("Error deleting remote files: ", err);
        throw err;
    }
};

const run = async (config: R2Config) => {
    const map = new Map<string, PutObjectCommandOutput | CompleteMultipartUploadCommandOutput>();
    const urls: FileMap = {};

    if (config.keepFileFresh) {
        const remotePrefix = config.destinationDir !== "" ? config.destinationDir : config.sourceDir;
        await deleteRemoteFiles(config.bucket, remotePrefix);
    }

    const files: FileMap = getFileList(config.sourceDir);

    for (const file in files) {
        console.log(config.sourceDir);
        console.log(config.destinationDir);
        //const fileName = file.replace(config.sourceDir, "");
        const fileName = files[file];
        // const fileKey = path.join(config.destinationDir !== "" ? config.destinationDir : config.sourceDir, fileName);

        const destinationDir = config.destinationDir.split(path.sep).join('/');
        const fileKey = path.posix.join(destinationDir !== "" ? destinationDir : config.sourceDir.split(path.sep).join('/'), fileName.split(path.sep).join('/'));

        if (fileName.includes('.gitkeep'))
            continue;

        console.log(fileKey);

        try {
            const fileMB = getFileSizeMB(file);
            console.info(`R2 Info - Uploading ${file} (${formatFileSize(file)}) to ${fileKey}`);
            const upload = fileMB > config.multiPartSize ? uploadMultiPart : putObject;
            const result = await upload(file, fileKey, config);
            map.set(file, result.output);
            urls[file] = result.url;
        } catch (err: unknown) {
            const error = err as S3ServiceException;
            if (error.hasOwnProperty("$metadata")) {
                if (error.$metadata.httpStatusCode !== 412) // If-None-Match
                    throw error;
            } else {
                console.error(`Error while uploading ${file} to ${fileKey}: `, err);
                throw error;
            }
        }
    }

    if (config.outputFileUrl) setOutput('file-urls', urls);
    return map;
};

const uploadMultiPart: UploadHandler<CompleteMultipartUploadCommandOutput> = async (file: string, fileName: string, config: R2Config) => {
    const mimeType = mime.getType(file);

    const createMultiPartParams: CreateMultipartUploadCommandInput = {
        Bucket: config.bucket,
        Key: fileName,
        ContentType: mimeType ?? 'application/octet-stream'
    }

    const cmd = new CreateMultipartUploadCommand(createMultiPartParams);

    const created = await S3.send(cmd);

    const chunkSize = 10 * 1024 * 1024; // 10MB

    const multiPartMap = {
        Parts: []
    }

    const totalSize = formatFileSize(file);
    let bytesRead = 0;
    let partNumber = 0;
    let interrupted = false;
    const uploads = [];
    for await (const chunk of readFixedChunkSize(file, chunkSize)) {

        const uploadPartParams: UploadPartCommandInput = {
            Bucket: config.bucket,
            Key: fileName,
            PartNumber: ++partNumber,
            UploadId: created.UploadId,
            Body: chunk,
        }

        const uploadPart = async (partNumber: number) => {
            const cmd = new UploadPartCommand(uploadPartParams);
            let retries = 0
            while (retries < config.maxTries) {
                if (interrupted) {
                    console.info(`R2 Info - Aborting upload part ${partNumber} of ${file} due to previous error`)
                    return;
                }
                try {
                    const result = await S3.send(cmd);
                    multiPartMap.Parts.push({ PartNumber: partNumber, ETag: result.ETag });
                    break;
                } catch (err: any) {
                    retries++;
                    console.error(`R2 Error - ${err.message}, retrying: ${retries}/${config.maxTries}`, err);
                    await sleep(300);
                }
            }
            if (retries >= config.maxTries) {
                console.info(`Retries exhausted, aborting upload`)
                interrupted = true;
                const abortParams: AbortMultipartUploadCommandInput = {
                    Bucket: config.bucket,
                    Key: fileName,
                    UploadId: created.UploadId
                }
                const cmd = new AbortMultipartUploadCommand(abortParams);
                await S3.send(cmd);
                throw new Error(`R2 Error - Failed to upload part ${partNumber} of ${file}`);
            }
            bytesRead += chunk.byteLength;
            console.info(`R2 Success - Uploaded part ${formatBytes(bytesRead)}/${totalSize} of ${file} (${partNumber})`)
        }

        if (config.multiPartConcurrent) {
            uploads.push(uploadPart(partNumber));
        } else {
            await uploadPart(partNumber);
        }
    }

    if (config.multiPartConcurrent) {
        await Promise.all(uploads);
    }

    console.info(`R2 Info - Completing upload of ${file} to ${fileName}`)

    const completeMultiPartUploadParams: CompleteMultipartUploadCommandInput = {
        Bucket: config.bucket,
        Key: fileName,
        UploadId: created.UploadId,
        MultipartUpload: multiPartMap
    }

    const completeCmd = new CompleteMultipartUploadCommand(completeMultiPartUploadParams);
    const data = await S3.send(completeCmd);
    console.log(`R2 Success - ${file}`);
    const url = await getSignedUrl(S3, completeCmd);
    return {
        output: data,
        url
    };
};

const putObject: UploadHandler<PutObjectCommandOutput> = async (file: string, fileName: string, config: R2Config) => {
    const mimeType = mime.getType(file);

    console.info(`using put object upload for ${fileName}`);

    const fileStream = fs.readFileSync(file);

    let contentType = mimeType ?? 'application/octet-stream';
    if (config.customCharset)
        contentType = `${contentType}; charset=${config.customCharset}`;

    const uploadParams: PutObjectCommandInput = {
        Bucket: config.bucket,
        Key: fileName,
        Body: fileStream,
        ContentLength: fs.statSync(file).size,
        ContentType: contentType
    };
    const cmd = new PutObjectCommand(uploadParams);
    const digest = md5(fileStream);
    cmd.middlewareStack.add((next: any) => async (args: any) => {
        args.request.headers['if-none-match'] = `"${digest}"`;
        return await next(args);
    }, {
        step: 'build',
        name: 'addETag'
    });
    const data = await S3.send(cmd);
    console.log(`R2 Success - ${file}`);
    const url = await getSignedUrl(S3, cmd);
    return {
        output: data,
        url
    };
};

run(config)
    .then(result => setOutput('result', 'success'))
    .catch(err => {
        if (err.hasOwnProperty('$metadata')) {
            console.error(`R2 Error - ${err.message}`);
        } else {
            console.error('Error', err);
        }

        setOutput('result', 'failure');
        setFailed(err.message);
    });
