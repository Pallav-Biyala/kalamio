import { describe, it, expect } from 'vitest'
import { dragHasFiles, pickDroppedImage } from './image-drop'

const file = (name, type) => new File(['x'], name, { type })

describe('image drop helpers', () => {
  it('only reacts to drags that carry files', () => {
    expect(dragHasFiles({ dataTransfer: { types: ['Files'] } })).toBe(true)
    expect(dragHasFiles({ dataTransfer: { types: ['text/plain', 'text/uri-list'] } })).toBe(false)
    expect(dragHasFiles({})).toBe(false)
  })

  it('picks the first image among the dropped files', () => {
    const png = file('a.png', 'image/png')
    expect(pickDroppedImage({ files: [file('notes.txt', 'text/plain'), png, file('b.jpg', 'image/jpeg')] }))
      .toEqual({ file: png, rejected: false })
  })

  it('flags drops with no image, and ignores empty drops', () => {
    expect(pickDroppedImage({ files: [file('doc.pdf', 'application/pdf')] })).toEqual({ file: null, rejected: true })
    expect(pickDroppedImage({ files: [] })).toEqual({ file: null, rejected: false })
    expect(pickDroppedImage(undefined)).toEqual({ file: null, rejected: false })
  })
})
