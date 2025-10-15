import { FileConverter } from "@/app/components/file-converter"

export default function Page() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-balance">Universal File Converter</h1>
        <p className="mt-2 text-muted-foreground text-pretty">
          Convert between JSON, CSV, XML, Text, and Excel (XLSX) entirely in your browser.
        </p>
      </header>
      <FileConverter />
    </main>
  )
}