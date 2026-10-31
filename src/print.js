import { esc } from './format'

export function companyBlock(settings) {
  return `<h1>${esc(settings.name)}</h1>
    <p class="muted">${esc(settings.address || '')}${settings.phone ? ` · ${esc(settings.phone)}` : ''}</p>`
}

export function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

function csvCell(value) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function downloadExcel(filename, rows) {
  const body = rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
  downloadFile(filename, `\ufeff${body}`, 'text/csv;charset=utf-8')
}

function printHtml(title, body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      body { font-family: Georgia, "Times New Roman", serif; color: #241910; margin: 28px; font-size: 14px; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      h2 { font-size: 16px; margin: 18px 0 8px; }
      p { margin: 4px 0; }
      .muted { color: #5c4a3a; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border-bottom: 1px solid #e6d9c8; padding: 8px 6px; text-align: left; vertical-align: top; color: #241910; }
      th { background: #f3e6d4; font-size: 12px; font-weight: 800; letter-spacing: 0.03em; text-transform: uppercase; white-space: nowrap; }
      th.num, td.num { width: 1%; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; padding-left: 20px; }
      th.sno, td.sno { width: 1%; text-align: center; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .sign { margin-top: 42px; display: flex; justify-content: space-between; gap: 24px; }
      .sign div { width: 42%; border-top: 1px solid #241910; padding-top: 6px; }
      @media print { body { margin: 12px; } }
    </style></head><body>${body}</body></html>`
}

function showPreview(title, html, autoPrint) {
  document.getElementById('print-preview')?.remove()
  const wrap = document.createElement('div')
  wrap.id = 'print-preview'
  wrap.className = 'print-preview'
  wrap.innerHTML = `
    <div class="print-preview-bar">
      <strong>${esc(title)}</strong>
      <p>To save PDF: Print → Destination → Save as PDF</p>
      <div class="row-actions">
        <button class="btn primary" type="button" data-print>Print / Save as PDF</button>
        <button class="btn print-close" type="button" data-close>Close</button>
      </div>
    </div>
    <iframe title="${esc(title)}"></iframe>
  `
  document.body.appendChild(wrap)
  const iframe = wrap.querySelector('iframe')
  const doc = iframe.contentDocument
  doc.open()
  doc.write(html)
  doc.close()

  const printNow = () => {
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
  }
  wrap.querySelector('[data-print]').addEventListener('click', printNow)
  wrap.querySelector('[data-close]').addEventListener('click', () => wrap.remove())
  wrap.addEventListener('click', (event) => {
    if (event.target === wrap) wrap.remove()
  })
  if (autoPrint) setTimeout(printNow, 250)
}

export function printDocument(title, body) {
  showPreview(title, printHtml(title, body), true)
  return true
}

export function downloadPdf(title, body) {
  showPreview(title, printHtml(title, `${body}<p class="muted">Print → Destination → Save as PDF</p>`), false)
  return true
}
