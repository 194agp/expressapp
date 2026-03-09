declare module 'docx-pdf' {
  function docxConverter(
    inputPath: string,
    outputPath: string,
    callback: (err: Error | null, result?: unknown) => void
  ): void;
  export = docxConverter;
}
