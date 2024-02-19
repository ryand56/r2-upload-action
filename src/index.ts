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
    CompleteMultipartUploadCommandOutput
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
    sourceDir: getInput("source-dir", { required: true }),
    destinationDir: getInput("destination-dir"),
    outputFileUrl: getInput("output-file-url") === 'true',
    multiPartSize: parseInt(getInput("multipart-size")) || 100,
    maxTries: parseInt(getInput("max-retries")) || 5,
};

const S3 = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
    },
});

const run = async (config: R2Config) => {
    const map = new Map<string, PutObjectCommandOutput | CompleteMultipartUploadCommandOutput>();
    const urls: FileMap = {};

    const files: string[] = getFileList(config.sourceDir);

    for (const file of files) {
        console.log(file);
        console.log(config.sourceDir);
        console.log(config.destinationDir);
        //const fileName = file.replace(/^.*[\\\/]/, "");
        const fileName = file.replace(config.sourceDir, "");
        const fileKey = path.join(config.destinationDir !== "" ? config.destinationDir : config.sourceDir, fileName);

        if (fileKey.includes('.gitkeep'))
            continue;
        
        console.log(fileKey);

        try {
            const fileMB = getFileSizeMB(file);
            console.info(`R2 Info - Uploading ${file} (${formatFileSize(file)}) to ${fileKey}`);
            const upload = fileMB > config.multiPartSize ? uploadMultiPart : putObject;
            const result = await upload(file, config);
            map.set(file, result.output);
            urls[file] = result.url;
        } catch (err: unknown) {
            const error = err as S3ServiceException;
            if (error.hasOwnProperty("$metadata")) {
                if (error.$metadata.httpStatusCode !== 412) // If-None-Match
                    throw error;
            } else {
                // why not throw normal error ?
                // if there's a reason, feel free to remove it
                console.error(`Error while uploading ${file} to ${fileKey}: `, err);
                throw error;
            }
        }
    }

    if (config.outputFileUrl) setOutput('file-urls', urls);
    return map;
};

const uploadMultiPart: UploadHandler<CompleteMultipartUploadCommandOutput> = async (file: string, config: R2Config) => {

    const fileName = file.replace(config.sourceDir, "");
    const fileKey = path.join(config.destinationDir !== "" ? config.destinationDir : config.sourceDir, fileName);
    const mimeType = mime.getType(file);

    const createMultiPartParams: CreateMultipartUploadCommandInput = {
        Bucket: config.bucket,
        Key: fileKey,
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
    for await (const chunk of readFixedChunkSize(file, chunkSize)) {

        const uploadPartParams: UploadPartCommandInput = {
            Bucket: config.bucket,
            Key: fileKey,
            PartNumber: ++partNumber,
            UploadId: created.UploadId,
            Body: chunk,
        }

        const cmd = new UploadPartCommand(uploadPartParams);
        let retries = 0
        while (retries < config.maxTries) {
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
            const abortParams: AbortMultipartUploadCommandInput = {
                Bucket: config.bucket,
                Key: fileKey,
                UploadId: created.UploadId
            }
            const cmd = new AbortMultipartUploadCommand(abortParams);
            await S3.send(cmd);
            throw new Error(`R2 Error - Failed to upload part ${partNumber} of ${file}`);
        }
        bytesRead += chunk.byteLength;
        console.info(`R2 Success - Uploaded part ${formatBytes(bytesRead)}/${totalSize} of ${file} (${partNumber})`)
    }

    console.info(`R2 Info - Completing upload of ${file} to ${fileKey}`)

    const completeMultiPartUploadParams: CompleteMultipartUploadCommandInput = {
        Bucket: config.bucket,
        Key: fileKey,
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


const putObject: UploadHandler<PutObjectCommandOutput> = async (file, config) => {
    const fileName = file.replace(config.sourceDir, "");
    const fileKey = path.join(config.destinationDir !== "" ? config.destinationDir : config.sourceDir, fileName);
    const mimeType = mime.getType(file);

    console.info(`using put object upload for ${fileKey}`);

    const fileStream = fs.readFileSync(file);
    const uploadParams: PutObjectCommandInput = {
        Bucket: config.bucket,
        Key: fileKey,
        Body: fileStream,
        ContentLength: fs.statSync(file).size,
        ContentType: mimeType ?? 'application/octet-stream'
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