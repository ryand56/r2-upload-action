import { R2Config, FileMap } from "./types.js";
import { getInput, setOutput, setFailed } from "@actions/core";
import {
    S3Client,
    PutObjectCommandInput,
    PutObjectCommand,
    PutObjectCommandOutput,
    S3ServiceException,
    ListObjectsV2Command,
    DeleteObjectsCommand,
    DeleteObjectsCommandInput
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as fs from "fs";
import mime from "mime";
import md5 from "md5";
import path from "path";
let config: R2Config = {
    accountId: getInput("r2-account-id", { required: true }),
    accessKeyId: getInput("r2-access-key-id", { required: true }),
    secretAccessKey: getInput("r2-secret-access-key", { required: true }),
    bucket: getInput("r2-bucket", { required: true }),
    sourceDir: getInput("source-dir", { required: true }),
    destinationDir: getInput("destination-dir"),
    outputFileUrl: getInput("output-file-url") === 'true',
    keepFileFresh: getInput("keep-file-fresh") === 'false'
};

const S3 = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
    },
});

const getFileList = (dir: string) => {
    let files: string[] = [];
    const items = fs.readdirSync(dir, {
        withFileTypes: true,
    });

    for (const item of items) {
        const isDir = item.isDirectory();
        const absolutePath = `${dir}/${item.name}`;
        if (isDir) {
            files = [...files, ...getFileList(absolutePath)];
        } else {
            files.push(absolutePath);
        }
    }

    return files;
};

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
    const map = new Map<string, PutObjectCommandOutput>();
    const urls: FileMap = {};

    if (config.keepFileFresh) {
        const remotePrefix = config.destinationDir !== "" ? config.destinationDir : config.sourceDir;
        await deleteRemoteFiles(config.bucket, remotePrefix);
    }

    const files: string[] = getFileList(config.sourceDir);

    for (const file of files) {
        console.log(file);
        const fileStream = fs.readFileSync(file);
        console.log(config.sourceDir);
        console.log(config.destinationDir);
        //const fileName = file.replace(/^.*[\\\/]/, "");
        const fileName = file.replace(config.sourceDir, "");
        const fileKey = path.join(config.destinationDir !== "" ? config.destinationDir : config.sourceDir, fileName);

        if (fileKey.includes('.gitkeep'))
            continue;
        
        console.log(fileKey);
        const mimeType = mime.getType(file);

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

        try {
            const data = await S3.send(cmd);
            console.log(`R2 Success - ${file}`);
            map.set(file, data);

            const fileUrl = await getSignedUrl(S3, cmd);
            urls[file] = fileUrl;
        } catch (err: unknown) {
            const error = err as S3ServiceException;
            if (error.hasOwnProperty("$metadata")) {
                if (error.$metadata.httpStatusCode !== 412) // If-None-Match
                    throw error;
            }
        }
    }

    if (config.outputFileUrl) setOutput('file-urls', urls);
    return map;
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