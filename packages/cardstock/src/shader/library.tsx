"use client";
import type * as React from "react";
import { createContext, useContext, useMemo } from "react";

import type { ShaderDefinition } from "./define";

const LibraryContext = createContext<ReadonlyMap<string, ShaderDefinition>>(new Map());

export interface ShaderLibraryProps {
  shaders: readonly ShaderDefinition[];
  children?: React.ReactNode;
}

/** Makes your own shaders available by id to every <Shader /> inside, so a background stored as
 * `{ type: "shader", shader: "acme/tide" }` finds its GLSL. Nested libraries add to the outer one;
 * an id here wins over the same id outside, and over a built-in. */
export function ShaderLibrary(props: ShaderLibraryProps): React.ReactElement {
  const outer = useContext(LibraryContext);
  const { shaders } = props;
  const value = useMemo(() => {
    const map = new Map(outer);
    for (const s of shaders) map.set(s.id, s);
    return map;
  }, [outer, shaders]);
  return <LibraryContext.Provider value={value}>{props.children}</LibraryContext.Provider>;
}

/** The shaders registered by the <ShaderLibrary>s around this. */
export const useShaderLibrary = (): ReadonlyMap<string, ShaderDefinition> => useContext(LibraryContext);
