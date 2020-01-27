const { Environment } = require('../')
const fs = require('fs')
const path = require('path')
const expect = require('chai').expect

const http = require('http')

const storj = new Environment({
    bridgeUser: '',
    bridgePass: '',
    encryptionKey: ''
})

let bucketId = ''
let fileId = ''

describe('# constructor', () => {

    it('should error if delete file from non-existent bucket', function (done) {
        this.timeout(30000)
        storj.removeFile('aaaaaaaaaaaaaaaaaaaaaaaa', '2912948b2bc135c0ff32ac5e', (err) => {
            done(err ? null : err)
        })
    })

    it('should create dummy file if not exists', function (done) {
        if (fs.existsSync("pruebas.bin")) { done() }
        else {
            const dummyFile = "http://ipv4.download.thinkbroadband.com/5MB.zip"
            const file = fs.createWriteStream("pruebas.bin");
            const request = http.get(dummyFile, function (response) {
                response.pipe(file);
            });

            request.on('finish', () => done())
        }

    })

    it('should list buckets', function (done) {
        this.timeout(300000)
        storj.listBuckets(function (err, buckets) {
            expect(err).to.be.null
            bucketId = buckets[0].bucketId
            done(err)
        })
    })

    it('should list files', function (done) {
        this.timeout(30000)
        storj.listFiles(bucketId, (err, files) => {
            expect(err).to.be.null
            if (files.length) {
                const filePruebas = files.filter(obj => obj.name === 'pruebas.bin')
                if (filePruebas.length > 0 && filePruebas[0].fileId) {
                    fileId = filePruebas[0].fileId
                }
            }
            done(err)
        })
    })

    it('should delete pruebas.bin if exists', function (done) {
        if (!fileId) {
            return done()
        }
        this.timeout(30000)
        storj.removeFile(bucketId, fileId, (err) => done(err))
    })


    it('should upload file', function (done) {
        this.timeout(300000)
        const absolutePath = path.resolve('pruebas.bin')
        storj.storeFile(bucketId, absolutePath, {
            finishedCallback: (err, fileId) => {
                expect(err).to.be.null
                expect(fileId).to.match(/^[a-z0-9]{24}$/)
                done(err)
            }
        })
    })
    
    it('should download file', function (done) {
        this.timeout(300000)

        storj.resolveFile('e6aa7b3ea8085ee5223c3d08', '025c9486deafce4cd3c91e64', './pruebas.bin', {
            finishedCallback: (err) => {
                done(err)
            },
            progressCallback: (progress) => {
                // console.log(progress)
            },
            overwritte: true
        })
    })
    

})