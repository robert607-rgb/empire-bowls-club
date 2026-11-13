import type { ReadableStream as WorkerReadableStream } from "@cloudflare/workers-types";

// Workers and browser declarations describe the same runtime streams but use
// incompatible TypeScript iterator and reader types. Convert only at the R2 boundary.
export const toWorkerStream = (stream: ReadableStream): WorkerReadableStream => stream as unknown as WorkerReadableStream;
export const toWebStream = (stream: WorkerReadableStream): ReadableStream => stream as unknown as ReadableStream;
