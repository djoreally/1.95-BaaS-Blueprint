/**
 * Error types for the cPanel/WHM adapter.
 *
 * Every failure that crosses the adapter boundary is one of these, so the
 * control plane can distinguish "the host said no" (retryable? billable?)
 * from "we asked wrong" (a bug in the adapter) without parsing strings.
 */

/** A cPanel UAPI call returned status 0, or the transport failed. */
export class UapiError extends Error {
  readonly module: string;
  readonly func: string;
  readonly httpStatus?: number;

  constructor(module: string, func: string, message: string, httpStatus?: number) {
    super(`UAPI ${module}::${func}: ${message}`);
    this.name = 'UapiError';
    this.module = module;
    this.func = func;
    this.httpStatus = httpStatus;
  }
}

/** A WHM API 1 call returned result 0, or the transport failed. */
export class WhmError extends Error {
  readonly func: string;
  readonly httpStatus?: number;

  constructor(func: string, message: string, httpStatus?: number) {
    super(`WHM ${func}: ${message}`);
    this.name = 'WhmError';
    this.func = func;
    this.httpStatus = httpStatus;
  }
}

/**
 * The server reports a cPanel major version newer than the one this adapter
 * was built and tested against. Refusing to run is deliberate: a silent
 * version drift is how "it worked on my host" bugs are born.
 */
export class VersionMismatchError extends Error {
  readonly pinned: string;
  readonly reported: string;

  constructor(pinned: string, reported: string) {
    super(
      `cPanel version drift: adapter pinned to v${pinned}, server reports ${reported}. ` +
        `Review packages/adapter-cpanel against the new API surface before proceeding.`,
    );
    this.name = 'VersionMismatchError';
    this.pinned = pinned;
    this.reported = reported;
  }
}

/** One step of a rollback (teardown) pass that failed. Provisioning still aborts. */
export interface RollbackFailure {
  step: string;
  error: string;
}

/**
 * createProject()/deleteProject() failed partway. `step` names the step that
 * failed; `rollback` reports what the compensating teardown managed to undo.
 * Anything left in `rollback` with an error needs manual cleanup in cPanel.
 */
export class ProvisionError extends Error {
  readonly step: string;
  readonly cause: unknown;
  readonly rollback: RollbackFailure[];

  constructor(step: string, cause: unknown, rollback: RollbackFailure[] = []) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`provisioning failed at step "${step}": ${detail}`);
    this.name = 'ProvisionError';
    this.step = step;
    this.cause = cause;
    this.rollback = rollback;
  }
}
