/**
 * Scheduler Interface
 * 
 * Re-exports the SchedulerInterface type and provides the factory for creating
 * scheduler instances. The Memory_Engine imports only from this module,
 * never from ts-fsrs directly (R2.1, R2.5).
 * 
 * This isolation makes tuning or replacing the algorithm low-cost.
 * 
 * @module core/scheduler/scheduler-interface
 */

export type {
  SchedulerInterface,
  SchedulerState,
  SchedulerRating,
  ScheduleInput,
  ScheduleResult,
} from '../types';
