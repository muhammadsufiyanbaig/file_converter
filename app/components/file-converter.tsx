"use client"

import type React from "react"

import { useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  convertFile,
  detectFormatFromFileName,
  extensionsByFormat,
  type Format,
  labelByFormat,
  mimeByFormat,
} from "@/utils"

type Option = { value: Format; label: string }

const formatOptions: Option[] = [
  { value: "json", label: labelByFormat.json },
  { value: "csv", label: labelByFormat.csv },
  { value: "xml", label: labelByFormat.xml },
  { value: "text", label: labelByFormat.text },
  { value: "excel", label: labelByFormat.excel },
]

export function FileConverter() {
  const [sourceFormat, setSourceFormat] = useState<Format | "">("")
  const [targetFormat, setTargetFormat] = useState<Format | "">("")
  const [file, setFile] = useState<File | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [resultText, setResultText] = useState<string>("")
  const [resultFileName, setResultFileName] = useState<string>("")

  const acceptAttr = useMemo(() => {
    if (!sourceFormat) return extensionsByFormat.all
    return extensionsByFormat[sourceFormat]
  }, [sourceFormat])

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      setFile(f ?? null)
      setError(null)
      if (f && !sourceFormat) {
        const detected = detectFormatFromFileName(f.name)
        if (detected) setSourceFormat(detected)
      }
    },
    [sourceFormat],
  )

  const handleConvert = useCallback(async () => {
    setError(null)
    setResultBlob(null)
    setResultText("")
    setResultFileName("")

    if (!file) {
      setError("Please choose a file to convert.")
      return
    }
    if (!sourceFormat || !targetFormat) {
      setError("Please select both source and target formats.")
      return
    }
    setIsConverting(true)
    try {
      const { blob, text, filename } = await convertFile(file, sourceFormat as Format, targetFormat as Format)
      setResultBlob(blob)
      setResultText(text ?? "")
      setResultFileName(filename)
    } catch (err: any) {
      setError(err?.message || "Conversion failed. Please check your input and try again.")
    } finally {
      setIsConverting(false)
    }
  }, [file, sourceFormat, targetFormat])

  const handleDownload = useCallback(() => {
    if (!resultBlob) return
    const url = URL.createObjectURL(resultBlob)
    const a = document.createElement("a")
    a.href = url
    a.download = resultFileName || "converted"
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [resultBlob, resultFileName])

  const isTextTarget = targetFormat && ["json", "csv", "xml", "text"].includes(targetFormat as string)
  const showPreview = isTextTarget && !!resultText

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-balance">Universal File Converter</CardTitle>
        <CardDescription className="text-pretty">
          Convert between JSON, CSV, XML, TEXT, and EXCEL (XLSX).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sourceFormat">Source format</Label>
            <Select value={sourceFormat || ""} onValueChange={(v) => setSourceFormat(v as Format)}>
              <SelectTrigger id="sourceFormat" aria-label="Source format">
                <SelectValue placeholder="Select source format" />
              </SelectTrigger>
              <SelectContent>
                {formatOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="targetFormat">Target format</Label>
            <Select value={targetFormat || ""} onValueChange={(v) => setTargetFormat(v as Format)}>
              <SelectTrigger id="targetFormat" aria-label="Target format">
                <SelectValue placeholder="Select target format" />
              </SelectTrigger>
              <SelectContent>
                {formatOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fileInput">Choose file</Label>
          <input
            id="fileInput"
            type="file"
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            accept={acceptAttr}
            onChange={onFileChange}
          />
          <p className="text-xs text-muted-foreground">Accepted: {acceptAttr || extensionsByFormat.all}</p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleConvert} disabled={isConverting || !file || !sourceFormat || !targetFormat}>
            {isConverting ? "Converting..." : "Convert"}
          </Button>
          {resultBlob && (
            <Button variant="secondary" onClick={handleDownload}>
              Download {labelByFormat[targetFormat as Format] || "file"}
            </Button>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {showPreview && (
          <div className="space-y-2">
            <Label htmlFor="preview">Preview (first 100KB)</Label>
            <Textarea
              id="preview"
              className="min-h-48 font-mono text-xs"
              readOnly
              value={resultText.slice(0, 100_000)}
            />
            <p className="text-xs text-muted-foreground">
              MIME: {mimeByFormat[targetFormat as Format] || "text/plain"} • Filename: {resultFileName || "converted"}
            </p>
          </div>
        )}

        {resultBlob && !showPreview && (
          <p className="text-sm text-muted-foreground">
            Conversion ready. Click "Download" to save the {labelByFormat[targetFormat as Format]} file.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
