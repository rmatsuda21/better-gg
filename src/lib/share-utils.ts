export async function generateResultImage(element: HTMLElement): Promise<Blob> {
  const { toBlob } = await import('html-to-image')

  // Wait for fonts to be ready
  await document.fonts.ready

  // Double-render workaround for Safari (first render loads resources)
  await toBlob(element, {
    pixelRatio: 2,
    skipFonts: true,
  }).catch(() => {
    // Ignore first render errors
  })

  const blob = await toBlob(element, {
    pixelRatio: 2,
    skipFonts: true,
  })

  if (!blob) throw new Error('Failed to generate image')
  return blob
}

export async function shareOrDownload(
  blob: Blob,
  filename: string,
): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' })

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] })
    return
  }

  // Fallback: download
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function downloadImage(
  blob: Blob,
  filename: string,
): Promise<void> {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function copyImageToClipboard(blob: Blob): Promise<void> {
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blob }),
  ])
}
