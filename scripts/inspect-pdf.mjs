import { PDFDocument, PDFName, PDFArray, PDFStream, PDFRawStream } from 'pdf-lib'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { inflateSync } from 'zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PDF_PATH = resolve(__dirname, '..', 'Proposta 155-2026.pdf')
const TARGET_PAGES = [1, 13, 14, 16] // 0-indexed: pages 2, 14, 15, 17

const bytes = readFileSync(PDF_PATH)
const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })

const totalPages = pdfDoc.getPageCount()
console.log(`Total pages in PDF: ${totalPages}\n`)

// Helper: decode a PDFRawStream (handles FlateDecode)
function decodeStream(stream) {
  const dict = stream.dict
  const filterName = PDFName.of('Filter')
  const filter = dict.lookup(filterName)
  const rawBytes = stream.contents

  if (!filter) return Buffer.from(rawBytes)

  const filterStr = filter.toString ? filter.toString() : String(filter)

  if (filterStr === '/FlateDecode' || filterStr === 'FlateDecode') {
    try {
      return inflateSync(Buffer.from(rawBytes))
    } catch (e) {
      // Try with a raw deflate
      try {
        return inflateSync(Buffer.from(rawBytes), { windowBits: -15 })
      } catch (e2) {
        return Buffer.from(rawBytes)
      }
    }
  }

  // No decode or unsupported filter
  return Buffer.from(rawBytes)
}

// Helper: get raw content string for a page
function getPageContent(pdfDoc, pageIndex) {
  const context = pdfDoc.context
  const page = pdfDoc.getPage(pageIndex)
  const pageNode = page.node

  const contentsKey = PDFName.of('Contents')
  const contentsObj = pageNode.get(contentsKey)

  if (!contentsObj) return ''

  const resolved = context.lookup(contentsObj)
  if (!resolved) return ''

  const streams = []

  const collectStream = (obj) => {
    if (!obj) return
    const name = obj.constructor ? obj.constructor.name : ''
    if (name === 'PDFRawStream') {
      try {
        const decoded = decodeStream(obj)
        streams.push(decoded.toString('latin1'))
      } catch (e) {
        streams.push(Buffer.from(obj.contents).toString('latin1'))
      }
    } else if (name === 'PDFArray') {
      for (let i = 0; i < obj.size(); i++) {
        const ref = obj.get(i)
        const s = context.lookup(ref)
        collectStream(s)
      }
    }
  }

  collectStream(resolved)
  return streams.join('\n')
}

// Parse PDF string token to JS string
const parseString = (s) => {
  if (s.startsWith('(') && s.endsWith(')')) {
    return s.slice(1, -1)
      .replace(/[\\]n/g, '\n')
      .replace(/[\\]r/g, '\r')
      .replace(/[\\]t/g, '\t')
      .replace(/[\\][\\]/g, '\\')
      .replace(/[\\][(]/g, '(')
      .replace(/[\\][)]/g, ')')
  }
  return s
}

const parseHexString = (s) => {
  if (s.startsWith('<') && s.endsWith('>')) {
    const hex = s.slice(1, -1).replace(/\s/g, '')
    let result = ''
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.slice(i, i + 2), 16)
      if (!isNaN(byte)) result += String.fromCharCode(byte)
    }
    return result
  }
  return s
}

// Tokenize a PDF content stream
const tokenize = (content) => {
  const tokens = []
  let i = 0
  const len = content.length

  while (i < len) {
    const ch = content[i]

    // Skip whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f') {
      i++; continue
    }

    // Comment
    if (ch === '%') {
      while (i < len && content[i] !== '\n' && content[i] !== '\r') i++
      continue
    }

    // Literal string (parentheses)
    if (ch === '(') {
      let j = i + 1
      let depth = 1
      let str = '('
      while (j < len && depth > 0) {
        const c = content[j]
        if (c === '\\') {
          str += c + (content[j + 1] || '')
          j += 2
          continue
        }
        if (c === '(') depth++
        if (c === ')') depth--
        if (depth > 0 || c !== ')') str += c
        j++
      }
      str += ')'
      tokens.push({ type: 'string', value: str })
      i = j
      continue
    }

    // Hex string or dict
    if (ch === '<') {
      if (content[i + 1] === '<') {
        // Dictionary — skip to matching >>
        let j = i + 2
        let depth = 1
        while (j < len && depth > 0) {
          if (content[j] === '<' && content[j + 1] === '<') { depth++; j += 2 }
          else if (content[j] === '>' && content[j + 1] === '>') { depth--; j += 2 }
          else j++
        }
        tokens.push({ type: 'dict', value: content.slice(i, j) })
        i = j
      } else {
        let j = i + 1
        while (j < len && content[j] !== '>') j++
        tokens.push({ type: 'hexstring', value: content.slice(i, j + 1) })
        i = j + 1
      }
      continue
    }

    // Array
    if (ch === '[') {
      let j = i + 1
      let depth = 1
      while (j < len && depth > 0) {
        if (content[j] === '[') depth++
        else if (content[j] === ']') depth--
        j++
      }
      tokens.push({ type: 'array', value: content.slice(i, j) })
      i = j
      continue
    }

    // Name
    if (ch === '/') {
      let j = i + 1
      while (j < len && !/[\s\[\]<>(){}\/]/.test(content[j])) j++
      tokens.push({ type: 'name', value: content.slice(i, j) })
      i = j
      continue
    }

    // Number or operator
    let j = i
    while (j < len && !/[\s\[\]<>(){}\/]/.test(content[j])) j++
    if (j > i) {
      tokens.push({ type: 'token', value: content.slice(i, j) })
    }
    i = j
  }
  return tokens
}

// Parse array token into its sub-tokens
const parseArray = (arrStr) => {
  // Remove outer brackets
  const inner = arrStr.slice(1, -1)
  return tokenize(inner)
}

// Extract text items from tokenized content stream
const extractTextItems = (tokens) => {
  const items = []
  const stack = []
  let inTextBlock = false
  let position = { x: 0, y: 0 }
  let lineMatrix = { x: 0, y: 0 }
  let fontSize = 12
  let leading = 0

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]

    if (tok.type !== 'token') {
      stack.push(tok)
      continue
    }

    const op = tok.value

    switch (op) {
      case 'BT':
        inTextBlock = true
        position = { x: 0, y: 0 }
        lineMatrix = { x: 0, y: 0 }
        stack.length = 0
        break

      case 'ET':
        inTextBlock = false
        stack.length = 0
        break

      case 'Tf':
        if (stack.length >= 2) {
          fontSize = parseFloat(stack[stack.length - 1].value) || fontSize
        }
        stack.length = 0
        break

      case 'TL':
        if (stack.length >= 1) {
          leading = parseFloat(stack[stack.length - 1].value) || 0
        }
        stack.length = 0
        break

      case 'Tm': {
        const nums = stack.slice(-6).map(t => parseFloat(t.value || 0))
        if (nums.length >= 6) {
          position = { x: nums[4], y: nums[5] }
          lineMatrix = { x: nums[4], y: nums[5] }
        }
        stack.length = 0
        break
      }

      case 'Td':
      case 'TD': {
        const nums = stack.slice(-2).map(t => parseFloat(t.value || 0))
        if (nums.length >= 2) {
          lineMatrix = {
            x: lineMatrix.x + nums[0],
            y: lineMatrix.y + nums[1]
          }
          position = { ...lineMatrix }
          if (op === 'TD') leading = -nums[1]
        }
        stack.length = 0
        break
      }

      case 'T*':
        lineMatrix = { x: lineMatrix.x, y: lineMatrix.y - leading }
        position = { ...lineMatrix }
        stack.length = 0
        break

      case 'Tj': {
        const strTok = [...stack].reverse().find(t => t.type === 'string' || t.type === 'hexstring')
        if (strTok && inTextBlock) {
          const text = strTok.type === 'string'
            ? parseString(strTok.value)
            : parseHexString(strTok.value)
          if (text.trim()) {
            items.push({ text, x: position.x, y: position.y, op: 'Tj' })
          }
        }
        stack.length = 0
        break
      }

      case 'TJ': {
        const arrTok = [...stack].reverse().find(t => t.type === 'array')
        if (arrTok && inTextBlock) {
          const subTokens = parseArray(arrTok.value)
          let combined = ''
          let lastWasNum = false
          for (const st of subTokens) {
            if (st.type === 'string') {
              if (lastWasNum && combined.length > 0) combined += ''
              combined += parseString(st.value)
              lastWasNum = false
            } else if (st.type === 'hexstring') {
              combined += parseHexString(st.value)
              lastWasNum = false
            } else if (st.type === 'token' && !isNaN(parseFloat(st.value))) {
              // Kerning — large negative = space
              const kern = parseFloat(st.value)
              if (kern < -100) combined += ' '
              lastWasNum = true
            }
          }
          if (combined.trim()) {
            items.push({ text: combined, x: position.x, y: position.y, op: 'TJ' })
          }
        }
        stack.length = 0
        break
      }

      case "'": {
        // T* then Tj
        lineMatrix = { x: lineMatrix.x, y: lineMatrix.y - leading }
        position = { ...lineMatrix }
        const strTok = [...stack].reverse().find(t => t.type === 'string' || t.type === 'hexstring')
        if (strTok && inTextBlock) {
          const text = strTok.type === 'string'
            ? parseString(strTok.value)
            : parseHexString(strTok.value)
          if (text.trim()) {
            items.push({ text, x: position.x, y: position.y, op: "'" })
          }
        }
        stack.length = 0
        break
      }

      case '"': {
        lineMatrix = { x: lineMatrix.x, y: lineMatrix.y - leading }
        position = { ...lineMatrix }
        const strTok = [...stack].reverse().find(t => t.type === 'string' || t.type === 'hexstring')
        if (strTok && inTextBlock) {
          const text = strTok.type === 'string'
            ? parseString(strTok.value)
            : parseHexString(strTok.value)
          if (text.trim()) {
            items.push({ text, x: position.x, y: position.y, op: '"' })
          }
        }
        stack.length = 0
        break
      }

      default:
        // Push numbers, clear on unknown operators
        if (!isNaN(parseFloat(op)) || op === '-' || op === '+') {
          stack.push({ type: 'token', value: op })
        } else {
          stack.length = 0
        }
    }
  }

  return items
}

// --- MAIN ---
for (const pageIndex of TARGET_PAGES) {
  const humanPage = pageIndex + 1
  console.log(`${'='.repeat(70)}`)
  console.log(`PAGE ${humanPage} (0-indexed: ${pageIndex})`)
  console.log(`${'='.repeat(70)}`)

  if (pageIndex >= totalPages) {
    console.log(`  [Page ${humanPage} does not exist — PDF only has ${totalPages} pages]\n`)
    continue
  }

  const page = pdfDoc.getPage(pageIndex)
  const { width, height } = page.getSize()
  console.log(`  Dimensions: ${width.toFixed(2)} x ${height.toFixed(2)} pt`)

  let rawContent = ''
  try {
    rawContent = getPageContent(pdfDoc, pageIndex)
  } catch (e) {
    console.log(`  [Error extracting content stream: ${e.message}]\n`)
    continue
  }

  if (!rawContent.trim()) {
    console.log('  [Empty content stream — page may be image-only]\n')
    continue
  }

  console.log(`  Content stream size: ${rawContent.length} bytes\n`)

  const tokens = tokenize(rawContent)
  const textItems = extractTextItems(tokens)

  if (textItems.length === 0) {
    console.log('  [No text items found — page content may be purely graphical or use unsupported encoding]\n')
    // Show a raw snippet for debugging
    const snippet = rawContent.slice(0, 500).replace(/[^\x20-\x7e\n]/g, '.')
    console.log('  Raw content snippet (first 500 chars):')
    console.log(snippet)
    console.log()
  } else {
    console.log(`  Found ${textItems.length} text item(s):\n`)
    for (let i = 0; i < textItems.length; i++) {
      const item = textItems[i]
      const pos = `x=${item.x.toFixed(2)}, y=${item.y.toFixed(2)}`
      const preview = item.text.replace(/\n/g, '[NL]').replace(/\r/g, '[CR]')
      console.log(`  [${String(i + 1).padStart(3)}] ${pos} | op=${item.op} | "${preview}"`)
    }
    console.log()
  }
}
