/**
 * Scheduler Module
 * 
 * Exports the SchedulerInterface and the FSRS adapter implementation.
 * The Memory_Engine should import from here, not from ts-fsrs.
 * 
 * @module core/scheduler
 */

export * from './scheduler-interface';
export { FsrsAdapter, createFsrsAdapter } from './fsrs-adapter';
