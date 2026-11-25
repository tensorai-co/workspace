// Paths are absolute, with "/" between segments and none at the end (except the root, "/").

export const normalPath = (path: string): string => `/${path.split('/').filter(Boolean).join('/')}`

export const joinPath = (dir: string, name: string): string => normalPath(`${dir}/${name}`)

export const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

export const dirName = (path: string): string => path.slice(0, Math.max(1, path.lastIndexOf('/')))

/** Whether path is dir, or somewhere inside it. */
export const isInside = (path: string, dir: string): boolean => path === dir || path.startsWith(dir === '/' ? '/' : `${dir}/`)

/** A path as seen from a folder: "src/main.tsx". */
export const relativePath = (root: string, path: string): string => (root === '/' ? path.slice(1) : path.slice(root.length + 1))

/** Drops paths that are inside another one in the list. */
export const topmost = (paths: readonly string[]): string[] => paths.filter((p) => !paths.some((q) => q !== p && isInside(p, q)))
