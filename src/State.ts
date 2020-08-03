import { ChildProcessWithoutNullStreams } from 'child_process'

export class State {
    handler: ChildProcessWithoutNullStreams
    constructor(handler: ChildProcessWithoutNullStreams) {
        this.handler = handler
    }
}