import { useState } from 'react'
import { createWorker } from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export default function Home() {
  const [processing, setProcessing] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState(null)

  async function handleUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setProcessing(true)

    // Converte PDF em imagens
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    // Inicializa o Tesseract.js (OCR)
    const worker = createWorker({ logger: m => console.log(m) })
    await worker.load()
    await worker.loadLanguage('por') // 'por' é Português
    await worker.initialize('por')

    const newPdf = await PDFDocument.create()

    // Para cada página do PDF original:
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise

      const { data: { text } } = await worker.recognize(canvas)

      // Insere a imagem e o texto invisível
      const jpgData = canvas.toDataURL('image/jpeg')
      const [img] = await newPdf.embedJpg(jpgData)
      const pdfPage = newPdf.addPage([viewport.width, viewport.height])
      pdfPage.drawImage(img, { x: 0, y: 0, width: viewport.width, height: viewport.height })
      const font = await newPdf.embedFont(StandardFonts.Helvetica)
      pdfPage.drawText(text, { x: 0, y: 0, size: 12, font, color: rgb(1,1,1), opacity: 0 })
    }

    await worker.terminate()
    const pdfBytes = await newPdf.save()
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    setDownloadUrl(URL.createObjectURL(blob))
    setProcessing(false)
  }

  return (
    <main style={{ padding: '2rem' }}>
      <h1>📄 OCR em PDF → PDF Pesquisável</h1>
      <input type="file" accept="application/pdf" onChange={handleUpload} />
      {processing && <p>Processando... Por favor aguarde.</p>}
      {downloadUrl && (
        <a href={downloadUrl} download="ocr.pdf">📥 Baixar PDF com texto pesquisável</a>
      )}
    </main>
  );
}
