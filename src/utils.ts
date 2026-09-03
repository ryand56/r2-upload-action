import { FileMap } from "./types.js";
import fs from 'fs';
import path from 'path';

export const formatBytes = (bytes: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"]

    if (bytes == 0) {
        return "0 Bytes"
    }

    const i = Math.floor(Math.log(bytes) / Math.log(1024))

    if (i == 0) {
        return bytes + " " + sizes[i]
    }

    return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i]
};

export const getFileList = (dir: string, oldDir?: string) => {
    let files: FileMap = {};
    let dirSplit = dir.trim().split("\n");

    for (const singleDir of dirSplit) {
        const trimmedDir = singleDir.trim();

        if (fs.statSync(trimmedDir).isFile())
            files[singleDir] = path.basename(trimmedDir);
        else
        {
            const items = fs.readdirSync(trimmedDir, {
                withFileTypes: true,
            });
    
            for (const item of items) {
                const isDir = item.isDirectory();
                const absolutePath = path.join(trimmedDir, item.name);
                if (isDir) {
                    files = {...files, ...getFileList(absolutePath, oldDir || trimmedDir)};
                } else {
                    files[absolutePath] = path.relative(oldDir || trimmedDir, absolutePath).split(path.sep).join('/');
                }
            }
        }
    }

    return files;
};

export const getFileSizeMB = (file: string) => {
    return fs.statSync(file).size / (1024 * 1024);
}

export const formatFileSize = (file: string) => {
    return formatBytes(fs.statSync(file).size);
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// In R2, fixed size for each chunk is required.
// FYR: https://community.cloudflare.com/t/all-non-trailing-parts-must-have-the-same-length/552190
export async function* readFixedChunkSize(file: string, chunkSize: number): AsyncIterable<Buffer> {
    const stream = fs.createReadStream(file);
    let buffer = Buffer.alloc(0);

    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);

        while (buffer.length >= chunkSize) {
            yield buffer.subarray(0, chunkSize);
            buffer = buffer.subarray(chunkSize);
        }
    }

    if (buffer.length > 0) {
        yield buffer;
    }
};
