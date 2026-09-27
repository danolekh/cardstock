/* One WebGL2 context and one animation frame for every live shader on the page, shared by every
 * library built on it. Framework-free: a surface is a 2D canvas the scheduler copies frames into. */
export {
  defineShader,
  uniformName,
  type ShaderDefinition,
  type ShaderDialect,
  type ShaderParamSpec,
  type Tone,
} from "./define";
export { composeFragment, ShaderSourceError, VERTEX } from "./compose";
export { resolveParams, type ResolvedUniform, type ShaderParamValue } from "./params";
export { advance, type PlayState } from "./policy";
export { parseRgb } from "./color";
export { createBackend, createFit, type Backend, type FrameInput, type OverlayInput } from "./backend";
export {
  createScheduler,
  pageScheduler,
  type OverlayHandle,
  type OverlayOptions,
  type Scheduler,
  type SchedulerEnv,
  type SurfaceHandle,
  type SurfaceInputs,
  type SurfaceOptions,
  type SurfaceStatus,
} from "./scheduler";
