/** A mistake in how the tool was called (an unknown name, a bad flag): the CLI prints it without a
 * stack and exits with 2, where anything else that goes wrong exits with 1. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}
