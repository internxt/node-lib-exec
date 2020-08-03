/// <reference types="node" />
import { ChildProcessWithoutNullStreams } from 'child_process';
export declare class State {
    handler: ChildProcessWithoutNullStreams;
    constructor(handler: ChildProcessWithoutNullStreams);
}
