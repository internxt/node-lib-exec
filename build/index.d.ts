/// <reference types="node" />
import { SpawnOptionsWithoutStdio } from 'child_process';
import { State } from './State';
interface EnvironmentOptions {
    bridgeUrl?: string;
    bridgeUser: string;
    bridgePass: string;
    encryptionKey: string;
}
interface UploadProgressCallback {
    (progress: Number, uploadedBytes: Number | null, totalBytes: Number | null): void;
}
interface DownloadProgressCallback {
    (progress: Number, downloadedBytes: Number | null, totalBytes: Number | null): void;
}
interface UploadFinishedCallback {
    (err: Error | null, newFileId: string | null): void;
}
interface OnlyErrorCallback {
    (err: Error | null): void;
}
interface StoreFileOptions {
    filename: string;
    progressCallback: UploadProgressCallback;
    finishedCallback: UploadFinishedCallback;
    debug?: (message: string) => void;
}
interface ResolveFileOptions {
    progressCallback: DownloadProgressCallback;
    finishedCallback: OnlyErrorCallback;
    overwritte?: boolean;
    debug?: (message: string) => void;
}
interface BucketFormat {
    bucketId: string;
    decrypted: boolean;
    creationDate: Date;
    bucketName: string;
}
interface FileFormat {
    id: string;
    size: Number;
    decrypted: boolean;
    mimetype: string;
    created: Date;
    filename: string;
}
interface GetBucketsCallback {
    (err: Error | null, bucketList: BucketFormat[]): void;
}
interface ListFilesCallback {
    (err: Error | null, filesList: FileFormat[]): void;
}
declare class Environment {
    constructor(config: EnvironmentOptions);
    config: EnvironmentOptions;
    private getExe;
    private getOs;
    private fileExists;
    exeSpawn(command: string, args: string[], options: SpawnOptionsWithoutStdio): import("child_process").ChildProcessWithoutNullStreams;
    storeFile(bucketId: string, filePath: string, options: StoreFileOptions): State | void;
    resolveFile(bucketId: string, fileId: string, filePath: string, options: ResolveFileOptions): State | void;
    getBuckets(callback: GetBucketsCallback): void;
    listFiles(bucketId: string, callback: ListFilesCallback): void;
    removeFile(bucketId: string, fileId: string, callback: OnlyErrorCallback): void;
    resolveFileCancel(state: State): void;
    storeFileCancel(state: State): void;
}
export { Environment };
