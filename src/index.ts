
import fs from 'fs'
import path from 'path'
import { spawn, SpawnOptionsWithoutStdio } from 'child_process';
import readline from 'readline'
import os from 'os'
import { State } from './State'

interface EnvironmentOptions {
    bridgeUrl?: string,
    bridgeUser: string,
    bridgePass: string,
    encryptionKey: string
}

interface UploadProgressCallback {
    (progress: Number, uploadedBytes: Number | null, totalBytes: Number | null): void
}

interface DownloadProgressCallback {
    (progress: Number, downloadedBytes: Number | null, totalBytes: Number | null): void
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
    finishedCallback: UploadFinishedCallback,
    debug?: (message: string) => void
}

interface ResolveFileOptions {
    progressCallback: DownloadProgressCallback,
    finishedCallback: OnlyErrorCallback,
    overwritte?: boolean
    debug?: (message: string) => void
}

interface BucketFormat {
    bucketId: string,
    decrypted: boolean,
    creationDate: Date,
    bucketName: string
}

interface FileFormat {
    id: string,
    size: Number,
    decrypted: boolean,
    mimetype: string,
    created: Date,
    filename: string
}

interface GetBucketsCallback {
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
        let pathExec = path.join('binaries', 'inxt-' + os + '-' + process.arch)
        pathExec = path.join(__dirname, '..', pathExec)
        if (os === 'win32') { pathExec += '.exe' }
        pathExec = pathExec.replace('app.asar', 'app.asar.unpacked')
        return pathExec
    }

    private getOs() {
        return { os: process.platform }
    }

    private fileExists() {
        const x = fs.existsSync(this.getExe())
        return x;
    }

    exeSpawn(command: string, args: string[], options: SpawnOptionsWithoutStdio) {
        fs.accessSync(command, fs.constants.X_OK)
        return spawn(command, args, options)
    }

    storeFile(bucketId: string, filePath: string, options: StoreFileOptions): State | void {
        if (!path.isAbsolute(filePath)) {
            return options.finishedCallback(new Error('Path must be absolute'), null)
        }

        if (!fs.existsSync(filePath)) {
            return options.finishedCallback(new Error('Cannot upload file: Doesn\'t exists'), null)
        }


        // Spawn child process, call to .EXE
        const storjExe = this.exeSpawn(this.getExe(), ["upload-file", bucketId, filePath], {
            env: {
                HOME: os.homedir(),
                STORJ_BRIDGE: this.config.bridgeUrl,
                STORJ_BRIDGE_USER: this.config.bridgeUser,
                STORJ_BRIDGE_PASS: this.config.bridgePass,
                STORJ_ENCRYPTION_KEY: this.config.encryptionKey
            }
        })

        const state = new State(storjExe)


        // Output results
        let result: string | null = null
        let error: Error | null = null

        storjExe.on('kill', () => {
            error = new Error('Process killed by user')
            storjExe.kill();
        })


        // Pipe the stdout steam to a readline interface
        const rl = readline.createInterface(storjExe.stdout)

        // Possible outputs
        const uploadFailurePattern = /^Upload failure\:\s+(.*)/
        const progressPattern = /^\[={0,}>?\s*\]\s+(\d+\.\d+)%$/
        const uploadSuccessPattern = /^Upload Success! File ID: ([a-z0-9]{24})$/
        const invalidFilePathPattern = /^Invalid file path: (.*)$/

        let timer: NodeJS.Timeout = setTimeout(() => {
            error = new Error('Node-lib timeout');
            storjExe.kill()
        }, 60 * 3 * 1000)

        // Process each line of output
        rl.on('line', (ln) => {
            clearTimeout(timer)
            if (options.debug) {
                options.debug(ln)
            }
            timer = setTimeout(() => {
                error = new Error('Node-lib timeout');
                storjExe.kill()
            }, 60 * 3 * 1000)
            const invalidFilePathFailure = invalidFilePathPattern.exec(ln)
            if (invalidFilePathFailure) {
                error = new Error(invalidFilePathFailure[0])
                return rl.close()
            }

            const uploadFailure = uploadFailurePattern.exec(ln)
            if (uploadFailure) {
                error = new Error(uploadFailure[1])
                return rl.close()
            }

            const uploadSuccess = uploadSuccessPattern.exec(ln)
            if (uploadSuccess) {
                result = uploadSuccess[1]
            }

            const isProgress = progressPattern.exec(ln)
            if (isProgress) {
                let progressPercentage = parseFloat(isProgress[1]) / 100
                if (typeof (options.progressCallback) === 'function') {
                    options.progressCallback(progressPercentage, null, null)
                }
            }

        })

        // Manage closed stream
        rl.on('close', () => {
            clearTimeout(timer)
            if (!error && !result) {
                options.finishedCallback(new Error('Unexpected process finish'), null);
            } else {
                options.finishedCallback(error, result)
            }
        })

        return state

    }

    resolveFile(bucketId: string, fileId: string, filePath: string, options: ResolveFileOptions): State | void {

        if (fs.existsSync(filePath)) {
            if (options.overwritte) {
                fs.unlinkSync(filePath)
            } else {
                return options.finishedCallback(new Error('File already exists'))
            }
        }

        const storjExe = this.exeSpawn(this.getExe(), ["download-file", bucketId, fileId, filePath], {
            env: {
                HOME: os.homedir(),
                STORJ_BRIDGE: this.config.bridgeUrl,
                STORJ_BRIDGE_USER: this.config.bridgeUser,
                STORJ_BRIDGE_PASS: this.config.bridgePass,
                STORJ_ENCRYPTION_KEY: this.config.encryptionKey
            }
        })

        const state = new State(storjExe)

        // Output results
        let error: Error | null = null

        state.handler.on('kill', () => {
            error = new Error('Process killed by user');
            state.handler.kill()
        })

        const rl = readline.createInterface(storjExe.stdout)

        // Possible outputs
        const progressPattern = /^\[={0,}>?\s*\]\s+(\d+\.\d+)%$/
        const downloadFailurePattern = /^Download failure: (.*)$/

        let timer: NodeJS.Timeout = setTimeout(() => {
            error = new Error('Node-lib timeout');
            storjExe.kill()
        }, 60 * 3 * 1000)
        rl.on('line', (ln) => {
            clearTimeout(timer)
            if (options.debug) {
                options.debug(ln);
            }
            timer = setTimeout(() => {
                error = new Error('Node-lib timeout');
                storjExe.kill()
            }, 60 * 3 * 1000)
            const downloadFailure = downloadFailurePattern.exec(ln)
            if (downloadFailure) {
                error = new Error(downloadFailure[1])
                return rl.close()
            }


            const isProgress = progressPattern.exec(ln)
            if (isProgress) {
                let progressPercentage = parseFloat(isProgress[1]) / 100
                if (typeof (options.progressCallback) === 'function') {
                    options.progressCallback(progressPercentage, null, null)
                }
                return;
            }


        });

        rl.on('close', () => {
            clearTimeout(timer)
            options.finishedCallback(error)
        })

        return state
    }

    getBuckets(callback: GetBucketsCallback) {
        const storjExe = this.exeSpawn(this.getExe(), ["list-buckets"], {
            env: {
                HOME: os.homedir(),
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
            if (typeof (callback) === 'function') {
                callback(error, results)
            }
        })

    }

    listFiles(bucketId: string, callback: ListFilesCallback) {
        // Spawn child process, call to .EXE
        const storjExe = this.exeSpawn(this.getExe(), ["list-files", bucketId], {
            env: {
                HOME: os.homedir(),
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
                    id: isFile[1],
                    size: parseInt(isFile[2]),
                    decrypted: isFile[3] === 'true',
                    mimetype: isFile[4],
                    created: new Date(isFile[5]),
                    filename: isFile[6]
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
        const storjExe = this.exeSpawn(this.getExe(), ["remove-file", bucketId, fileId], {
            env: {
                HOME: os.homedir(),
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

    resolveFileCancel(state: State) {
        state.handler.emit('kill');
    }

    storeFileCancel(state: State) {
        state.handler.emit('kill');
    }
}

export { Environment }