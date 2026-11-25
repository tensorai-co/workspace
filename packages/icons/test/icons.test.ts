import { describe, expect, it } from 'vitest'
import { codicon, fileIcon } from '../src/index.js'

describe('fileIcon', () => {
  it('resolves file names, extensions and languages', () => {
    const tsx = fileIcon('App.tsx', { languageId: 'typescriptreact' })
    expect(tsx?.color).toBe('#498ba7')
    expect(tsx?.body).toContain('<path')
    expect(tsx?.body).not.toContain('fill=')
    expect(fileIcon('App.tsx', { theme: 'dark', languageId: 'typescriptreact' })?.color).toBe('#519aba')
    // Exact names beat languages; JSON files go by language.
    expect(fileIcon('tsconfig.json', { languageId: 'jsonc' })?.body).not.toBe(fileIcon('package.json', { languageId: 'json' })?.body)
    expect(fileIcon('.gitignore', { languageId: 'ignore' })?.color).toBe('#3b4b52')
    expect(fileIcon('README.md')?.color).toBe('#498ba7')
    expect(fileIcon('LICENSE')?.color).toBe('#b7b73b')
    expect(fileIcon('Cargo.toml')?.color).toBe('#627379')
    expect(fileIcon('no-idea.zzz')).toBeDefined()
    expect(codicon('chevron-right').body).toContain('<path')
  })
})
