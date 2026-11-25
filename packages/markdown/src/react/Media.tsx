import type { FileSystem } from '@tensorai-workspace/host'
import { useContext, useEffect, useState, type ComponentProps, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { imageType, resolveImage, resolveLink, type LinkTarget } from '../core/links.js'
import { Preview } from './context.js'

type AnchorProps = ComponentProps<'a'>

/** A link: to the web in a new tab, or to a heading or a file through the preview. One that leads nowhere is text. */
export function Link({ href, children, ...rest }: AnchorProps & { href: string; children?: ReactNode }) {
  const preview = useContext(Preview)
  const target = resolveLink(href, preview)
  if (!target) return <a {...rest}>{children}</a>
  if (target.kind === 'web') {
    return (
      <a
        {...rest}
        href={target.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (preview.open(target)) e.preventDefault()
        }}
      >
        {children}
      </a>
    )
  }
  return (
    <Inside {...rest} target={target}>
      {children}
    </Inside>
  )
}

/** Without an address, so that no click can take the page elsewhere. */
function Inside({ target, children, ...rest }: Omit<AnchorProps, 'target'> & { target: LinkTarget }) {
  const preview = useContext(Preview)
  const open = (e: MouseEvent | KeyboardEvent) => {
    e.preventDefault()
    preview.open(target)
  }
  return (
    <a {...rest} className="ws-md-link" role="link" tabIndex={0} onClick={open} onKeyDown={(e) => e.key === 'Enter' && open(e)}>
      {children}
    </a>
  )
}

/** An image from the web, the file itself or the file system. */
export function Image({ src, ...rest }: ComponentProps<'img'> & { src: string }) {
  const preview = useContext(Preview)
  const target = resolveImage(src, preview)
  const path = target?.kind === 'file' ? target.path : undefined
  const file = useFile(preview.fs, path)
  const url = target?.kind === 'web' ? (preview.remoteImages || target.url.startsWith('data:') ? target.url : undefined) : file
  return <img {...rest} src={url} referrerPolicy="no-referrer" />
}

/** A file as a URL an image can have. Follows the file when it changes. */
function useFile(fs: FileSystem | undefined, path: string | undefined): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!fs || path === undefined) return setUrl(undefined)
    let current = true
    let made: string | undefined
    const put = (next: string | undefined) => {
      if (made) URL.revokeObjectURL(made)
      made = next
      setUrl(next)
    }
    const read = () =>
      void fs.read(path).then(
        (data) => {
          if (!current) return
          const type = imageType(path)
          put(type && URL.createObjectURL(new Blob([data as Uint8Array<ArrayBuffer>], { type })))
        },
        () => current && put(undefined), // Its description shows in its place.
      )
    read()
    const stop = fs.watch?.(path, read)
    return () => {
      current = false
      stop?.()
      if (made) URL.revokeObjectURL(made)
    }
  }, [fs, path])
  return url
}
