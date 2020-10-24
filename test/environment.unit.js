const { Environment } = require('../')
const fs = require('fs')
const path = require('path')
const expect = require('chai').expect
const http = require('http')
require('dotenv').config()

const inxt = new Environment({
    bridgeUser: process.env.TEST_BRIDGE_USER,
    bridgePass: process.env.TEST_BRIDGE_PASS,
    encryptionKey: process.env.TEST_BRIDGE_KEY
})

let bucketId = ''
let fileId = ''

describe('# constructor', () => {

    it('should have network credentials', () => {
        expect(inxt.config.bridgeUser).not.equals('')
        expect(inxt.config.bridgePass).not.equals('')
        expect(inxt.config.encryptionKey).not.equals('')
    })

    it('should error if delete file from non-existent bucket', function (done) {
        this.timeout(30000)
        inxt.removeFile('2912948b2bc135c0ff32ac5e', '2912948b2bc135c0ff32ac5e', (err) => {
            expect(err).not.null
            done()
        })
    })

    it('should create dummy file if not exists', function (done) {
        this.timeout(300000)
        const next = done
        if (fs.existsSync("pruebas.bin")) { fs.unlinkSync("pruebas.bin") }
        const dummyFile = "http://www.s551963162.mialojamiento.es/50MB.zip"
        const file = fs.createWriteStream("pruebas.bin");
        const request = http.get(dummyFile, function (response) {
            response.pipe(file);

            file.on('finish', () => {
                file.close(() => {
                    next()
                })
            })
        }).on('error', (err) => {
            next(err)
        });
    })

    it('should list buckets', function (done) {
        this.timeout(300000)
        inxt.getBuckets(function (err, buckets) {
            expect(err).to.be.null
            bucketId = buckets[0].bucketId
            done(err)
        })
    })

    it('should list files', function (done) {
        this.timeout(30000)
        inxt.listFiles(bucketId, (err, files) => {
            expect(err).to.be.null
            if (files.length) {
                const filePruebas = files.filter(obj => obj.filename === 'pruebas.bin')
                if (filePruebas.length > 0 && filePruebas[0].id) {
                    fileId = filePruebas[0].id
                }
            }
            done(err)
        })
    })

    it('should error if you try to list files of a non-existent bucket', () => {
        inxt.listFiles('aaaaaaaaaaaaaaaaaaaaaaaa', (err, files) => {
            expect(err).not.null
        })

    })

    it('should delete pruebas.bin if exists', function (done) {
        if (!fileId) {
            return done()
        }
        this.timeout(30000)
        inxt.removeFile(bucketId, fileId, (err) => done(err))
    })


    it('should upload file', function (done) {
        this.timeout(300000)
        const absolutePath = path.resolve('pruebas.bin')
        inxt.storeFile(bucketId, absolutePath, {
            finishedCallback: (err, fileId) => {
                expect(err).to.be.null
                expect(fileId).to.match(/^[a-z0-9]{24}$/)
                done(err)
            },
            progressCallback: (progress) => {
                expect(progress >= 0 && progress <= 1).to.be.true
            }
        })
    })

    it('should download file', function (done) {
        this.timeout(300000)

        inxt.resolveFile(bucketId, fileId, './pruebas.bin', {
            finishedCallback: (err) => {
                done(err)
            },
            progressCallback: (progress) => { 
                expect(progress >= 0 && progress <= 1).to.be.true
             },
            overwritte: true
        })
    })

    it('should stop download', function (done) {
        this.timeout(300000)

        const state = inxt.resolveFile(bucketId, fileId, './pruebas2.bin', {
            finishedCallback: (err) => {
                console.log('Download finished')
                done()
            },
            progressCallback: (progress) => {
                if (progress > 0.1) {
                    state.handler.kill()
                }
            },
            overwritte: true
        })
    })


})