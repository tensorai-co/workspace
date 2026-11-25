/** What the Markdown preview is checked with: one of everything. */
export const markdown = `---
title: A title
tags: [one, two]
---

# Heading one

A paragraph with **bold**, *italic*, ~~gone~~, \`code\` and [a link](https://example.com), long enough to go on to a
second line and then some, so that there are a few of them.

## Heading two

- one
- two
  - inside
    1. deep
- three

1. first
2. second

* loose one

* loose two

### Heading three

> A quote, with \`code\`.
>
> Two paragraphs of it.

#### Heading four

| Left | Middle | Right |
| ---- | :----: | ----: |
| a    | b      | c     |
| d    | e      | f     |
| g    | h      | i     |

##### Heading five

\`\`\`ts
const one = 1
function two(): number {
  return one + 1
}
\`\`\`

    indented

###### Heading six

---

Press <kbd>K</kbd>. H<sub>2</sub>O, x<sup>2</sup>. [\`code link\`](https://example.com)

<p align="center">In the middle</p>

<details open>
<summary>More</summary>

Inside.

</details>

The end.
`
