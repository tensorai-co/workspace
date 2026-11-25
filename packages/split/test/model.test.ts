import { describe, expect, it } from 'vitest'
import { SplitModel, type PaneSpec } from '../src/core/index.js'

const make = (panes: PaneSpec[], total = 1000, gap = 0) => {
  const m = new SplitModel(panes, { gap })
  m.layout(total)
  return m
}
const show = (m: SplitModel) => m.panes.map((p) => (p.visible ? Math.round(p.size) : '-')).join(' ')
const drag = (m: SplitModel, sash: number, ...deltas: number[]) => {
  m.startDrag(sash)
  for (const d of deltas) m.dragTo(d)
}
const ide = (): PaneSpec[] => [
  { id: 'side', size: 256, min: 170, snap: true },
  { id: 'main', min: 220, grow: true },
  { id: 'aux', size: 248, min: 150, snap: true },
]

describe('layout', () => {
  it('gives sized panes their size and shares the rest', () => {
    expect(show(make([{ id: 'a', size: 200 }, { id: 'b' }, { id: 'c' }]))).toBe('200 400 400')
    expect(show(make(ide()))).toBe('256 496 248')
  })

  it('counts the gaps', () => {
    const m = make(ide(), 1008, 4)
    expect(show(m)).toBe('256 496 248')
    expect(m.panes.map((p) => p.offset)).toEqual([0, 260, 760])
    expect(m.sashes.map((s) => s.position)).toEqual([258, 758])
  })

  it('grows and shrinks the pane that should, then the others, and never past a minimum while there is room', () => {
    const m = make(ide())
    m.layout(1200)
    expect(show(m)).toBe('256 696 248')
    m.layout(700)
    expect(show(m)).toBe('256 220 224')
    m.layout(560)
    expect(show(m)).toBe('190 220 150')
    // Too small for all the minimums: still nothing runs past the end.
    m.layout(400)
    expect(m.panes.reduce((sum, p) => sum + p.size, 0)).toBe(400)
  })

  it('keeps the proportions of panes with no size of their own', () => {
    const m = make([{ id: 'a' }, { id: 'b' }])
    drag(m, 0, 100)
    m.endDrag()
    expect(show(m)).toBe('600 400')
    m.layout(500)
    expect(show(m)).toBe('300 200')
  })
})

describe('dragging', () => {
  it('moves room across the sash, within the limits', () => {
    const m = make(ide())
    drag(m, 0, 50)
    expect(show(m)).toBe('306 446 248')
    m.dragTo(-60)
    expect(show(m)).toBe('196 556 248')
    m.dragTo(-100)
    expect(show(m)).toBe('170 582 248')
    m.dragTo(0)
    expect(show(m)).toBe('256 496 248')
  })

  it('takes from the next pane once the nearest is at its minimum', () => {
    const m = make([{ id: 'a', size: 200, min: 100 }, { id: 'b', size: 200, min: 100 }, { id: 'c' }])
    drag(m, 1, -150)
    expect(show(m)).toBe('150 100 750')
  })

  it('respects maximums', () => {
    const m = make([{ id: 'a', size: 200, max: 300 }, { id: 'b' }])
    drag(m, 0, 500)
    expect(show(m)).toBe('300 700')
  })

  it('closes a pane dragged past half its minimum, and opens it on the way back', () => {
    const m = make(ide())
    drag(m, 0, -86 - 84)
    expect(show(m)).toBe('170 582 248')
    m.dragTo(-86 - 86)
    expect(show(m)).toBe('- 752 248')
    m.dragTo(-86)
    expect(show(m)).toBe('170 582 248')
    m.dragTo(-200)
    m.endDrag()
    expect(show(m)).toBe('- 752 248')
    // It still has a sash, to drag it open with.
    expect(m.sashes.map((s) => s.index)).toEqual([0, 1])
    drag(m, 0, 50)
    expect(show(m)).toBe('- 752 248')
    m.dragTo(90)
    expect(show(m)).toBe('170 582 248')
    m.dragTo(300)
    expect(show(m)).toBe('300 452 248')
    m.endDrag()
    expect(show(m)).toBe('300 452 248')
  })

  it('closes the last pane the same way', () => {
    const m = make(ide())
    drag(m, 1, 98 + 76)
    expect(show(m)).toBe('256 744 -')
    m.endDrag()
    drag(m, 1, -80)
    expect(show(m)).toBe('256 594 150')
  })

  it('says which way a sash can go', () => {
    const m = make(ide())
    drag(m, 0, -86)
    m.endDrag()
    expect(m.sashes[0]).toMatchObject({ atMin: true, atMax: false, enabled: true })
    const fixed = make([{ id: 'a', size: 100, min: 100, max: 100 }, { id: 'b' }])
    expect(fixed.sashes[0]!.enabled).toBe(false)
  })
})

describe('opening and closing', () => {
  it('opens at the size it had', () => {
    const m = make(ide())
    m.resize('side', 300)
    m.setVisible('side', false)
    expect(show(m)).toBe('- 752 248')
    m.setVisible('side', true)
    expect(show(m)).toBe('300 452 248')
  })

  it('keeps one sash between the neighbors of a hidden pane', () => {
    const m = make([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    m.setVisible('b', false)
    expect(m.sashes).toHaveLength(1)
    drag(m, m.sashes[0]!.index, 100)
    m.endDrag()
    expect(show(m).replace('-', 'x')).toMatch(/^\d+ x \d+$/)
    expect(m.panes[0]!.size + m.panes[2]!.size).toBe(1000)
    expect(m.sashes[0]!.position).toBe(m.panes[0]!.size)
  })
})

describe('resetting', () => {
  it('goes back to the size asked for, or to equal shares', () => {
    const m = make(ide())
    drag(m, 0, 120)
    m.endDrag()
    m.reset(0)
    expect(show(m)).toBe('256 496 248')
    const even = make([{ id: 'a' }, { id: 'b' }])
    drag(even, 0, -200)
    even.endDrag()
    even.reset(0)
    expect(show(even)).toBe('500 500')
  })
})

describe('changing the panes', () => {
  it('splits the pane before a new one, and gives the room back', () => {
    const m = make([{ id: 'a' }, { id: 'b' }])
    drag(m, 0, 100)
    m.endDrag()
    m.setPanes([{ id: 'a' }, { id: 'a2' }, { id: 'b' }])
    expect(show(m)).toBe('300 300 400')
    m.setPanes([{ id: 'a' }, { id: 'b' }])
    expect(show(m)).toBe('600 400')
    m.setPanes([{ id: 'b' }])
    expect(show(m)).toBe('1000')
  })

  it('gives a new pane the size it asks for', () => {
    const m = make([{ id: 'main', grow: true }])
    m.setPanes([{ id: 'main', grow: true }, { id: 'aux', size: 248 }])
    expect(show(m)).toBe('752 248')
  })
})

describe('saving', () => {
  it('restores sizes and what was closed', () => {
    const m = make(ide())
    m.resize('side', 300)
    m.setVisible('aux', false)
    const saved = JSON.parse(JSON.stringify(m.save()))
    const next = new SplitModel(ide())
    next.restore(saved)
    next.layout(1000)
    expect(show(next)).toBe('300 700 -')
    next.setVisible('aux', true)
    expect(show(next)).toBe('300 452 248')
  })
})

it('always adds up, whatever happens', () => {
  let seed = 7
  const random = (n: number) => (seed = (seed * 1103515245 + 12345) % 2147483648) % n
  for (let round = 0; round < 300; round++) {
    const gap = random(2) * 4
    const m = make([{ id: 'a', size: 200, min: 100, snap: true }, { id: 'b', min: 120, grow: true }, { id: 'c', min: 80 }, { id: 'd', size: 150, min: 90, max: 300, snap: true }], 900, gap)
    let total = 900
    for (let step = 0; step < 20; step++) {
      const what = random(5)
      if (what === 0) m.layout((total = 600 + random(800)))
      else if (what === 1) m.setVisible(['a', 'd'][random(2)]!, random(2) === 0)
      else if (what === 2) {
        const sash = m.sashes[random(m.sashes.length)]
        if (sash) m.reset(sash.index)
      } else {
        const sash = m.sashes[random(m.sashes.length)]
        if (!sash) continue
        drag(m, sash.index, random(800) - 400, random(800) - 400)
        if (random(2)) m.endDrag()
        else {
          m.dragTo(0)
          m.endDrag()
        }
      }
      const open = m.panes.filter((p) => p.visible)
      const sum = open.reduce((s, p) => s + p.size, 0) + gap * Math.max(0, open.length - 1)
      expect(Math.abs(sum - total), JSON.stringify(m.panes)).toBeLessThan(0.01)
      for (const p of open) expect(p.size).toBeGreaterThanOrEqual(0)
    }
  }
})
