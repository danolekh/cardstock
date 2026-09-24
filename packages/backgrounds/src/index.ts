/* The programmatic side of cardstock-backgrounds, for build scripts and tooling: the same steps
 * the CLI runs, without the printing. */

export { addPresets, type AddOptions, type AddResult, type AddedPreset, type FileStatus } from "./add.ts";
export {
  buildBackground,
  parsePosition,
  DEFAULT_SIZES,
  WIDTH,
  HEIGHT,
  type BuildOptions,
  type BuildResult,
  type BuiltFile,
  type Format,
} from "./build.ts";
export {
  contrastRatio,
  luminance,
  oklchToRgb,
  rgbToOklch,
  suggestInk,
  hexToRgb,
  rgbToHex,
  type Oklch,
  type Rgb,
} from "./color.ts";
export { UsageError } from "./errors.ts";
export {
  loadManifest,
  validateManifest,
  presetBackground,
  ManifestError,
  DEFAULT_MANIFEST,
  type LoadedManifest,
  type Manifest,
  type ManifestBackground,
  type ManifestFile,
  type ManifestPreset,
} from "./manifest.ts";
export {
  mergePresetsJson,
  mergePresetsTs,
  presetKeys,
  writePresets,
  type MergeOptions,
  type MergeResult,
  type PresetEntries,
  type WritePresetsOptions,
} from "./presets-file.ts";
