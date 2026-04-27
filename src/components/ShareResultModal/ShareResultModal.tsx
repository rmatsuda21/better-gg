import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  generateResultImage,
  shareOrDownload,
  downloadImage,
  copyImageToClipboard,
} from '../../lib/share-utils'
import { ResultGraphic } from './ResultGraphic'
import type { SetSummary, CharacterEntry } from './ResultGraphic'
import { TIMING_MS } from '../../lib/constants'
import styles from './ShareResultModal.module.css'

type ModalState = 'generating' | 'ready' | 'error'

interface ShareResultModalProps {
  isOpen: boolean
  onClose: () => void
  tournamentName: string
  eventName: string
  tournamentLogo: string | null
  dateRange: string
  location: string
  numEntrants: number
  isOnline: boolean
  playerTag: string
  placement: number | null
  seed: number | null
  wins: number
  losses: number
  sets: SetSummary[]
  characters: CharacterEntry[]
}

export function ShareResultModal({
  isOpen,
  onClose,
  ...graphicProps
}: ShareResultModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const graphicRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<ModalState>('generating')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [copied, setCopied] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Pre-convert external logo to data URL to avoid CORS issues with html-to-image.
  // Routes through /api/image-proxy (Vite dev server proxy) so the fetch is same-origin.
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
  const [logoReady, setLogoReady] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setLogoDataUrl(null)
    setLogoReady(false)

    const logoUrl = graphicProps.tournamentLogo
    if (!logoUrl) {
      setLogoReady(true)
      return
    }

    // Rewrite images.start.gg URL to same-origin proxy
    let proxiedUrl = logoUrl
    try {
      const parsed = new URL(logoUrl)
      if (parsed.hostname === 'images.start.gg') {
        proxiedUrl = `/api/image-proxy${parsed.pathname}`
      }
    } catch {
      // Not a valid URL — use as-is
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        setLogoDataUrl(canvas.toDataURL('image/jpeg', 0.85))
      } catch {
        // Canvas tainted or other error — skip logo
      }
      setLogoReady(true)
    }
    img.onerror = () => {
      // Failed to load — proceed without logo
      setLogoReady(true)
    }
    img.src = proxiedUrl
  }, [isOpen, graphicProps.tournamentLogo])

  // Generate image after logo is ready
  useEffect(() => {
    if (!isOpen || !logoReady) return
    setState('generating')
    setImageUrl(null)
    setBlob(null)
    setErrorMsg(null)

    // Wait a frame for the off-screen graphic to render with the data URL
    const timer = setTimeout(async () => {
      if (!graphicRef.current) {
        setState('error')
        setErrorMsg('Graphic element not found')
        return
      }
      try {
        const result = await generateResultImage(graphicRef.current)
        const url = URL.createObjectURL(result)
        setBlob(result)
        setImageUrl(url)
        setState('ready')
      } catch (err) {
        setState('error')
        setErrorMsg(err instanceof Error ? err.message : 'Failed to generate image')
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [isOpen, logoReady])

  // Cleanup blob URL
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl)
    }
  }, [imageUrl])

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Escape key close
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const filename = `${graphicProps.playerTag}-${graphicProps.tournamentName}.png`
    .replace(/[^a-zA-Z0-9.-]/g, '-')
    .replace(/-+/g, '-')

  const canShare =
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'

  const canCopy =
    typeof navigator.clipboard?.write === 'function' &&
    typeof ClipboardItem !== 'undefined'

  const handleShare = async () => {
    if (!blob) return
    try {
      await shareOrDownload(blob, filename)
    } catch {
      // User cancelled share or share failed silently
    }
  }

  const handleDownload = async () => {
    if (!blob) return
    await downloadImage(blob, filename)
  }

  const handleCopy = async () => {
    if (!blob) return
    try {
      await copyImageToClipboard(blob)
      setCopied(true)
      setTimeout(() => setCopied(false), TIMING_MS.COPY_FEEDBACK)
    } catch {
      // Clipboard write failed — try download instead
      await downloadImage(blob, filename)
    }
  }

  return createPortal(
    <>
      {/* Off-screen graphic for capture */}
      <div className={styles.offscreen}>
        <ResultGraphic
          ref={graphicRef}
          {...graphicProps}
          tournamentLogo={logoDataUrl}
        />
      </div>

      {/* Modal overlay */}
      <div
        className={styles.overlay}
        ref={overlayRef}
        onMouseDown={(e) => {
          if (e.target === overlayRef.current) onClose()
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Share tournament result"
      >
        <div className={styles.modal}>
          {/* Mobile drag handle */}
          <div className={styles.dragHandle}>
            <div className={styles.dragPill} />
          </div>

          {/* Header */}
          <div className={styles.header}>
            <span className={styles.title}>Share Result</span>
            <button
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          {/* Content */}
          <div className={styles.body}>
            {state === 'generating' && (
              <div className={styles.loadingState}>
                <div className={styles.spinner} />
                <span className={styles.loadingText}>Generating image...</span>
              </div>
            )}

            {state === 'error' && (
              <div className={styles.errorState}>
                <span className={styles.errorText}>
                  {errorMsg ?? 'Something went wrong'}
                </span>
              </div>
            )}

            {state === 'ready' && imageUrl && (
              <>
                <div className={styles.preview}>
                  <img
                    src={imageUrl}
                    alt="Tournament result graphic"
                    className={styles.previewImage}
                  />
                </div>

                <div className={styles.actions}>
                  <button
                    className={styles.actionButton}
                    onClick={handleDownload}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M8 1v10m0 0L4.5 7.5M8 11l3.5-3.5M2 13.5h12"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Download
                  </button>

                  {canCopy && (
                    <button
                      className={styles.actionButton}
                      onClick={handleCopy}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <rect
                          x="5"
                          y="5"
                          width="9"
                          height="9"
                          rx="1.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <path
                          d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  )}

                  {canShare && (
                    <button
                      className={`${styles.actionButton} ${styles.actionPrimary}`}
                      onClick={handleShare}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <circle
                          cx="12"
                          cy="3"
                          r="2"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <circle
                          cx="4"
                          cy="8"
                          r="2"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <circle
                          cx="12"
                          cy="13"
                          r="2"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <path
                          d="M5.7 6.9l4.6-2.8M5.7 9.1l4.6 2.8"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                      Share
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
