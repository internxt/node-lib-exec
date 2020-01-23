
import fs from 'fs'
import path from 'path'
import { execFile, spawn } from 'child_process';
import readline from 'readline'

interface EnvironmentOptions {
    bridgeUrl?: string,
    bridgeUser: string,
    bridgePass: string,
    encryptionKey: string
}

interface UploadProgressCallback {
    (progress: Number | string, uploadedBytes: Number | null, totalBytes: Number | null): void
}

interface DownloadProgressCallback {
    (progress: Number | string, downloadedBytes: Number | null, totalBytes: Number | null): void
}

interface UploadFinishedCallback {
    (err: Error | null, newFileId: string | null): void
}

interface OnlyErrorCallback {
    (err: Error | null): void
}

interface StoreFileOptions {
    filename: string,
    progressCallback: UploadProgressCallback,
    finishedCallback: UploadFinishedCallback
}

interface ResolveFileOptions {
    progressCallback: DownloadProgressCallback,
    finishedCallback: OnlyErrorCallback,
    overwritte?: boolean
}


interface BucketFormat {
    bucketId: string,
    decrypted: boolean,
    creationDate: Date,
    bucketName: string
}

interface FileFormat {
    fileId: string,
    size: Number,
    decrypted: boolean,
    type: string,
    created: Date,
    name: string
}

interface ListBucketsCallback {
    (err: Error | null, bucketList: BucketFormat[]): void
}

interface ListFilesCallback {
    (err: Error | null, filesList: FileFormat[]): void
}

class Environment {
    constructor(config: EnvironmentOptions) {
        if (!config.bridgeUrl) {
            config.bridgeUrl = 'https://api.internxt.com'
        }

        this.config = config
    }

    config: EnvironmentOptions

    private getExe() {
        const os = process.platform
        let pathExec = 'binaries/storj-' + os + '-' + process.arch
        pathExec = 'binaries/storj-' + os + '-x32'
        if (os === 'win32') { pathExec += '.exe' }
        return pathExec
    }

    private getOs() {
        return { os: process.platform }
    }

    private fileExists() {
        const x = fs.existsSync(this.getExe())
        return x;
    }

    storeFile(bucketId: string, filePath: string, options: StoreFileOptions) {

        if (!path.isAbsolute(filePath)) {
            return options.finishedCallback(new Error('Path must be absolute'), null)
        }

        if (!fs.existsSync(filePath)) {
            return options.finishedCallback(new Error('Cannot upload file: Doesn\'t exists'), null)
        }


        // Spawn child process, call to .EXE
        const storjExe = spawn(this.getExe(), ["upload-file", bucketId, filePath], {
            env: {
                STORJ_BRIDGE: this.config.bridgeUrl,
                STORJ_BRIDGE_USER: this.config.bridgeUser,
                STORJ_BRIDGE_PASS: this.config.bridgePass,
                STORJ_ENCRYPTION_KEY: this.config.encryptionKey
            }
        })

        // Pipe the stdout steam to a readline interface
        const rl = readline.createInterface(storjExe.stdout)

        // Output results
        let result: string | null = null
        let error: Error | null = null

        // Possible outputs
        const uploadFailurePattern = /^Upload failure\:\s+(.*)/
        const progressPattern = /^\[={0,}>\s+\]\s+(\d+\.\d+)%$/

        // Process each line of output
        rl.on('line', (ln) => {
            const uploadFailure = uploadFailurePattern.exec(ln)
            if (uploadFailure) {
                error = new Error(uploadFailure[1])
                return rl.close()
            }

            const isProgress = progressPattern.exec(ln)
            if (isProgress) {
                if (typeof (options.progressCallback) == 'function') {
                    options.progressCallback(isProgress[1], null, null)
                }
            }
        })

        // Manage closed stream
        rl.on('close', () => {
            options.finishedCallback(error, result)
        })

    }

    resolveFile(bucketId: string, fileId: string, filePath: string, options: ResolveFileOptions) {

        if (fs.existsSync(filePath)) {
            if (options.overwritte) {
                fs.unlinkSync(filePath)
            } else {
                return options.finishedCallback(new Error('File already exists'))
            }
        }

        const storjExe = spawn(this.getExe(), ["download-file", bucketId, fileId, filePath], {
            env: {
                STORJ_BRIDGE: this.config.bridgeUrl,
                STORJ_BRIDGE_USER: this.config.bridgeUser,
                STORJ_BRIDGE_PASS: this.config.bridgePass,
                STORJ_ENCRYPTION_KEY: this.config.encryptionKey
            }
        })

        const rl = readline.createInterface(storjExe.stdout)

        const progressPattern = /^\[={0,}>\s+\]\s+(\d+\.\d+)%$/
        let error: Error | null = null

        rl.on('line', (ln) => {
            const isProgress = progressPattern.exec(ln)
            if (isProgress) {
                if (typeof (options.progressCallback) == 'function') {
                    options.progressCallback(isProgress[1], null, null)
                }
            } else if (ln == 'Download Success!') {
                rl.close()
            }
        });

        rl.on('close', () => {
            options.finishedCallback(error)
        })


    }

    listBuckets(callback: ListBucketsCallback) {
        const storjExe = spawn(this.getExe(), ["list-buckets"], {
            env: {
                STORJ_BRIDGE: this.config.bridgeUrl,
                STORJ_BRIDGE_USER: this.config.bridgeUser,
                STORJ_BRIDGE_PASS: this.config.bridgePass,
                STORJ_ENCRYPTION_KEY: this.config.encryptionKey
            }
        })

        const rl = readline.createInterface(storjExe.stdout)

        const pattern = /^ID: ([a-z0-9]{24})\s+Decrypted: (true|false)\s+Created: (.*Z)\s+Name: (.*)$/

        let results: BucketFormat[] = [];
        let error: Error | null = null

        rl.on('line', (ln) => {
            if (ln === 'Invalid user credentials.') {
                error = new Error(ln)
                rl.close()
            }
            const r = pattern.exec(ln)
            if (r) {
                const bucket: BucketFormat = {
                    bucketId: r[1],
                    decrypted: r[2] === 'true',
                    creationDate: new Date(r[3]),
                    bucketName: r[4]
                }
                results.push(bucket)
            }
        })

        rl.on('close', () => {
            if (typeof (callback) == 'function') {
                callback(error, results)
            }
        })

    }

    listFiles(bucketId: string, callback: ListFilesCallback) {
        // Spawn child process, call to .EXE
        const storjExe = spawn(this.getExe(), ["list-files", bucketId], {
            env: {
                STORJ_BRIDGE: this.config.bridgeUrl,
                STORJ_BRIDGE_USER: this.config.bridgeUser,
                STORJ_BRIDGE_PASS: this.config.bridgePass,
                STORJ_ENCRYPTION_KEY: this.config.encryptionKey
            }
        })

        // Pipe the stdout steam to a readline interface
        const rl = readline.createInterface(storjExe.stdout)

        // Output results
        let results: FileFormat[] = []
        let error: Error | null = null

        const pattern = /^ID: ([a-z0-9]{24})\s+Size:\s+(\d+) bytes\s+Decrypted: (true|false)\s+Type:\s+(.*)\s+Created: (.*Z)\s+Name: (.*)$/
        const nonExists = /^Bucket id .* does not exist$/

        rl.on('line', (ln) => {
            const errorExists = nonExists.exec(ln)
            if (errorExists) {
                error = new Error(ln)
                return rl.close()
            }

            const isFile = pattern.exec(ln)
            if (isFile) {
                const file: FileFormat = {
                    fileId: isFile[1],
                    size: parseInt(isFile[2]),
                    decrypted: isFile[3] === 'true',
                    type: isFile[4],
                    created: new Date(isFile[5]),
                    name: isFile[6]
                }
                return results.push(file)

            }

            console.log('List files=>', ln)
        })

        rl.on('close', () => {
            callback(error, results)
        })

    }

    removeFile(bucketId: string, fileId: string, callback: OnlyErrorCallback) {
        const storjExe = spawn(this.getExe(), ["remove-file", bucketId, fileId], {
            env: {
                STORJ_BRIDGE: this.config.bridgeUrl,
                STORJ_BRIDGE_USER: this.config.bridgeUser,
                STORJ_BRIDGE_PASS: this.config.bridgePass,
                STORJ_ENCRYPTION_KEY: this.config.encryptionKey
            }
        })

        const rl = readline.createInterface(storjExe.stdout)

        let error: Error | null = null

        const removeSuccessPattern = /^File was successfully removed from bucket\.$/
        const removeErrorPattern = /^Failed to remove file from bucket.*/

        rl.on('line', (ln) => {
            const removeError = removeErrorPattern.exec(ln)

            if (removeError) {
                error = new Error(removeError[0])
                return rl.close()
            }
            const removeSuccess = removeSuccessPattern.exec(ln)

            if (removeSuccess) {
                return rl.close();
            }
            console.log(ln)
        })

        rl.on('close', () => {
            callback(error)
        })

    }


}

export { Environment }