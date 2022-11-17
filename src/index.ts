import { R2Config, FileMap } from "./types.js";
import { getInput, setOutput, setFailed } from "@actions/core";
import {
    S3Client,
    PutObjectCommandInput,
    PutObjectCommand,
    PutObjectCommandOutput
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as fs from "fs";
import mime from "mime";
import md5 from "md5";

let config: R2Config = {
    accountId: getInput("r2-account-id", { required: true }),
    accessKeyId: getInput("r2-access-key-id", { required: true }),
    secretAccessKey: getInput("r2-secret-access-key", { required: true }),
    bucket: getInput("r2-bucket", { required: true }),
    sourceDir: getInput("source-dir", { required: true }),
    destinationDir: getInput("destination-dir"),
    outputFileUrl: getInput("output-file-url") === 'true'
};

const S3 = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
    }
});

const getFileList = (dir: string) => {
    let files: string[] = [];
    const items = fs.readdirSync(dir, {
        withFileTypes: true
    });

    for (const item of items) {
        const isDir = item.isDirectory();
        if (isDir) {
            files = [...files, ...getFileList(`${dir}${item.name}`)];
        } else {
            files.push(`${dir}${item.name}`);
        }
    }

    return files;
};

const run = async (config: R2Config) => {
    const map = new Map<string, PutObjectCommandOutput>();
    const urls: FileMap = {};

    const files: string[] = getFileList(config.sourceDir);

    for (const file of files) {
        console.log(file);
        const fileStream = fs.readFileSync(file);
        console.log(config.sourceDir);
        const sourceDirRegex = new RegExp(config.sourceDir, 'g');
        console.log(config.destinationDir);
        const fileName = file.replace(sourceDirRegex, config.destinationDir);

        if (fileName.includes('.gitkeep'))
            continue;
        
        console.log(fileName);
        const mimeType = mime.getType(file);

        const uploadParams: PutObjectCommandInput = {
            Bucket: config.bucket,
            Key: fileName,
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
        console.log(`R2 Success - ${data.$metadata.httpStatusCode} - ${file}`);
        map.set(file, data);

        const fileUrl = await getSignedUrl(S3, cmd);
        urls[file] = fileUrl;
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
            console.error('JS Error', err);
        }
        
        setOutput('result', 'failure');
        setFailed(err.message);
    });