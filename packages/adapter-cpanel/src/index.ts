/**
 * @baas-195/adapter-cpanel — the ONLY place raw cPanel/WHM calls live.
 *
 * Everything above this package (supervisor, control plane) uses these typed
 * functions. Nothing above touches fetch() for hosting APIs.
 */
export {
  UapiClient,
  SUPPORTED_UAPI_VERSION,
  assertCompatibleVersion,
} from './uapi.js';
export type { UapiConfig, UapiCallRecord, CronLine } from './uapi.js';

export { WhmClient } from './whm.js';
export type { WhmConfig, WhmAccountSummary, AccountPackage } from './whm.js';

export { createProject, deleteProject } from './provision.js';
export type {
  CreateProjectInput,
  ProjectProvisioned,
  TeardownReport,
  CronSchedule,
} from './provision.js';

export { UapiError, WhmError, VersionMismatchError, ProvisionError } from './errors.js';
export type { RollbackFailure } from './errors.js';
