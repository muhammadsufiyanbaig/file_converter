// Utilities for converting between JSON, CSV, XML, TEXT, and EXCEL (XLSX)

import * as XLSX from "xlsx"
import { XMLBuilder, XMLParser } from "fast-xml-parser"

export type Format = "json" | "csv" | "xml" | "text" | "excel"

export const labelByFormat: Record<Format, string> = {
  json: "JSON",
  csv: "CSV",
  xml: "XML",
  text: "Text",
  excel: "Excel (XLSX)",
}

export const mimeByFormat: Record<Format, string> = {
  json: "application/json",
  csv: "text/csv",
  xml: "application/xml",
  text: "text/plain",
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

export const extensionsByFormat: Record<Format | "all", string> = {
  json: ".json,application/json",
  csv: ".csv,text/csv",
  xml: ".xml,application/xml,text/xml",
  text: ".txt,text/plain,.log,.md",
  excel: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  all: ".json,.csv,.xml,.txt,.xlsx",
}

export function detectFormatFromFileName(name: string): Format | null {
  const lower = name.toLowerCase()
  if (lower.endsWith(".json")) return "json"
  if (lower.endsWith(".csv")) return "csv"
  if (lower.endsWith(".xml")) return "xml"
  if (lower.endsWith(".txt") || lower.endsWith(".log") || lower.endsWith(".md")) return "text"
  if (lower.endsWith(".xlsx")) return "excel"
  return null
}

function baseNameWithoutExt(filename: string): string {
  const idx = filename.lastIndexOf(".")
  return idx > 0 ? filename.slice(0, idx) : filename
}

async function fileToText(file: File): Promise<string> {
  return await file.text()
}

async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer()
}

// Convert any parsed JSON-like value to an array of objects suitable for CSV/XLSX
function jsonToRows(jsonValue: any): Record<string, any>[] {
  if (Array.isArray(jsonValue)) {
    // Ensure each item is an object; wrap primitives
    return jsonValue.map((item) => (item !== null && typeof item === "object" ? item : { value: item }))
  }
  if (jsonValue !== null && typeof jsonValue === "object") {
    return [jsonValue]
  }
  return [{ value: jsonValue }]
}

function rowsToCsv(rows: Record<string, any>[]): string {
  const ws = XLSX.utils.json_to_sheet(rows)
  return XLSX.utils.sheet_to_csv(ws)
}

function rowsToWorkbook(rows: Record<string, any>[], sheetName = "Sheet1"): XLSX.WorkBook {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  return wb
}

function csvStringToRows(csvText: string): Record<string, any>[] {
  const wb = XLSX.read(csvText, { type: "string" })
  const first = wb.SheetNames[0]
  const ws = wb.Sheets[first]
  return XLSX.utils.sheet_to_json(ws) as Record<string, any>[]
}

function xlsxToRows(ab: ArrayBuffer): Record<string, any>[] {
  const wb = XLSX.read(new Uint8Array(ab), { type: "array" })
  const first = wb.SheetNames[0]
  const ws = wb.Sheets[first]
  return XLSX.utils.sheet_to_json(ws) as Record<string, any>[]
}

function buildXmlFromValue(value: any): string {
  // Wrap arrays under items/item for consistent XML output
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    suppressEmptyNode: true,
  })
  let root: any
  if (Array.isArray(value)) {
    root = { items: { item: value } }
  } else if (value !== null && typeof value === "object") {
    root = value
  } else {
    root = { value }
  }
  return builder.build(root)
}

function parseXmlToJson(xmlText: string): any {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: true,
    trimValues: true,
  })
  return parser.parse(xmlText)
}

function textToRows(text: string): Record<string, any>[] {
  const lines = text.split(/\r?\n/)
  return lines.map((l) => ({ value: l }))
}

function safeJsonParse(text: string): any | undefined {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function blobFromText(text: string, format: Format): Blob {
  return new Blob([text], { type: mimeByFormat[format] || "text/plain" })
}

function blobFromWorkbook(wb: XLSX.WorkBook): Blob {
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" })
  return new Blob([out], { type: mimeByFormat.excel })
}

export async function convertFile(
  file: File,
  source: Format,
  target: Format,
): Promise<{ blob: Blob; text?: string; filename: string }> {
  const originalBase = baseNameWithoutExt(file.name) || "converted"
  const outExt =
    target === "excel"
      ? ".xlsx"
      : target === "json"
        ? ".json"
        : target === "csv"
          ? ".csv"
          : target === "xml"
            ? ".xml"
            : ".txt"
  const filename = `${originalBase}${outExt}`

  // Quick pass-through if target equals source and not excel (we still normalize excel)
  // But we'll still parse/rewrite to ensure consistent formatting.

  // Parse source into an intermediate representation
  let jsonValue: any | undefined
  let rows: Record<string, any>[] | undefined
  let text: string | undefined

  if (source === "json") {
    const t = await fileToText(file)
    const parsed = JSON.parse(t)
    jsonValue = parsed
  } else if (source === "csv") {
    const t = await fileToText(file)
    rows = csvStringToRows(t)
  } else if (source === "xml") {
    const t = await fileToText(file)
    jsonValue = parseXmlToJson(t)
  } else if (source === "text") {
    text = await fileToText(file)
  } else if (source === "excel") {
    const ab = await fileToArrayBuffer(file)
    rows = xlsxToRows(ab)
  } else {
    throw new Error("Unsupported source format.")
  }

  // Convert to target
  if (target === "json") {
    const value =
      jsonValue !== undefined
        ? jsonValue
        : rows !== undefined
          ? rows
          : text !== undefined
            ? (safeJsonParse(text) ?? { text })
            : null
    const output = JSON.stringify(value, null, 2)
    return { blob: blobFromText(output, "json"), text: output, filename }
  }

  if (target === "csv") {
    const arr =
      rows !== undefined
        ? rows
        : jsonValue !== undefined
          ? jsonToRows(jsonValue)
          : text !== undefined
            ? textToRows(text)
            : []
    const csv = rowsToCsv(arr)
    return { blob: blobFromText(csv, "csv"), text: csv, filename }
  }

  if (target === "xml") {
    const value = jsonValue !== undefined ? jsonValue : rows !== undefined ? rows : text !== undefined ? { text } : null
    const xml = buildXmlFromValue(value)
    return { blob: blobFromText(xml, "xml"), text: xml, filename }
  }

  if (target === "text") {
    // Prefer a human-friendly representation:
    // - rows -> CSV text
    // - json -> pretty JSON
    // - text -> as-is
    if (rows !== undefined) {
      const csv = rowsToCsv(rows)
      return { blob: blobFromText(csv, "text"), text: csv, filename }
    }
    if (jsonValue !== undefined) {
      const pretty = JSON.stringify(jsonValue, null, 2)
      return { blob: blobFromText(pretty, "text"), text: pretty, filename }
    }
    const asIs = text ?? ""
    return { blob: blobFromText(asIs, "text"), text: asIs, filename }
  }

  if (target === "excel") {
    const arr =
      rows !== undefined
        ? rows
        : jsonValue !== undefined
          ? jsonToRows(jsonValue)
          : text !== undefined
            ? textToRows(text)
            : []
    const wb = rowsToWorkbook(arr)
    const blob = blobFromWorkbook(wb)
    return { blob, filename }
  }

  throw new Error("Unsupported target format.")
}
