"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { saveFile } from "@/lib/saveFile";
import { convertHeicToImage, type HeicOutputMime } from "@/lib/converters/heic";
import { convertDocxToHtml, convertDocxToText } from "@/lib/converters/docx";
import { csvToJson, jsonToCsv, parseCsv } from "@/lib/converters/csv";
import { markdownToHtml } from "@/lib/converters/markdown";
import { fetchRemoteFile, RemoteFetchError } from "@/lib/converters/remoteFetch";
import {
  CONVERTERS,
  detectConverterInput,
  type ConverterInputDef,
  type ConverterOutputFormat,
} from "@/lib/converters/registry";

function track(eventName: string, params?: Record<string, unknown>) {
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag === "function") gtag("event", eventName, params || {});
}

export interface ConverterResult {
  blob: Blob;
  filename: string;
  // Result kinds that render an inline text/HTML preview in the Result
  // step, as opposed to just offering a download.
  previewText?: string;
  previewIsHtml?: boolean;
}

export type RemoteFetchFailure = { reason: RemoteFetchError["reason"]; message: string };

export function useConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [inputDef, setInputDef] = useState<ConverterInputDef | null>(null);
  const [outputFormat, setOutputFormat] = useState<ConverterOutputFormat | null>(null);
  const [result, setResult] = useState<ConverterResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [remoteFetchFailure, setRemoteFetchFailure] = useState<RemoteFetchFailure | null>(null);
  const [isFetchingRemote, setIsFetchingRemote] = useState(false);
  const { showToast } = useToast();

  // Upload -> Configure -> Result, same wizard shape as the other two
  // hooks. A single file at a time (unlike the batch compressor/wallpaper
  // tools) since a conversion's output format/options are per-file.
  const [stepIndex, setStepIndex] = useState(0);

  // Bumped when the sheet is cleared, so an in-flight convert() can notice
  // it should stop applying its result - same discipline as
  // useImageCompressor's clearGeneration / useWallpaperFit's clearGeneration.
  const clearGeneration = useRef(0);

  const setInputFile = useCallback((f: File) => {
    const def = detectConverterInput(f);
    if (!def) {
      showToast(`"${f.name}" isn't a supported file type for conversion yet`);
      return;
    }
    track("converter_upload", { input_kind: def.kind });
    setFile(f);
    setInputDef(def);
    setOutputFormat(def.outputs[0]?.format ?? null);
    setResult(null);
    setRemoteFetchFailure(null);
    setStepIndex(1);
  }, [showToast]);

  const tryFetchRemote = useCallback(
    async (url: string) => {
      setIsFetchingRemote(true);
      setRemoteFetchFailure(null);
      try {
        const { file: fetchedFile } = await fetchRemoteFile(url);
        setIsFetchingRemote(false);
        setInputFile(fetchedFile);
      } catch (err) {
        setIsFetchingRemote(false);
        if (err instanceof RemoteFetchError) {
          setRemoteFetchFailure({ reason: err.reason, message: err.message });
        } else {
          setRemoteFetchFailure({ reason: "network", message: "Something went wrong fetching that link." });
        }
      }
    },
    [setInputFile]
  );

  const convert = useCallback(async () => {
    if (!file || !inputDef || !outputFormat) return;
    setIsProcessing(true);
    const startGeneration = clearGeneration.current;
    track("converter_run", { input_kind: inputDef.kind, output_format: outputFormat });

    const outputOption = inputDef.outputs.find((o) => o.format === outputFormat);
    const baseName = file.name.replace(/\.[^.]+$/, "") || "converted";

    try {
      let next: ConverterResult;

      if (inputDef.kind === "heic") {
        const mime = outputFormat as HeicOutputMime;
        const blob = await convertHeicToImage(file, mime);
        next = { blob, filename: `${baseName}.${outputOption?.extension ?? "jpg"}` };
      } else if (inputDef.kind === "docx") {
        const text =
          outputFormat === "text/html" ? await convertDocxToHtml(file) : await convertDocxToText(file);
        const blob = new Blob([text], { type: outputFormat === "text/html" ? "text/html" : "text/plain" });
        next = {
          blob,
          filename: `${baseName}.${outputOption?.extension ?? "txt"}`,
          previewText: text,
          previewIsHtml: outputFormat === "text/html",
        };
      } else if (inputDef.kind === "csv") {
        const rows = await parseCsv(file);
        if (outputFormat === "application/json") {
          const json = csvToJson(rows);
          next = { blob: new Blob([json], { type: "application/json" }), filename: `${baseName}.json`, previewText: json };
        } else {
          const headers = rows.length ? Object.keys(rows[0]) : [];
          const tableHtml = [
            "<table>",
            "<thead><tr>",
            ...headers.map((h) => `<th>${h}</th>`),
            "</tr></thead><tbody>",
            ...rows.map((row) => `<tr>${headers.map((h) => `<td>${row[h] ?? ""}</td>`).join("")}</tr>`),
            "</tbody></table>",
          ].join("");
          next = {
            blob: new Blob([tableHtml], { type: "text/html" }),
            filename: `${baseName}.html`,
            previewText: tableHtml,
            previewIsHtml: true,
          };
        }
      } else if (inputDef.kind === "json") {
        const text = await file.text();
        const parsed = JSON.parse(text) as Record<string, unknown>[];
        const csv = jsonToCsv(Array.isArray(parsed) ? parsed : [parsed]);
        next = { blob: new Blob([csv], { type: "text/csv" }), filename: `${baseName}.csv`, previewText: csv };
      } else {
        // markdown
        const text = await file.text();
        const html = await markdownToHtml(text);
        next = {
          blob: new Blob([html], { type: "text/html" }),
          filename: `${baseName}.html`,
          previewText: html,
          previewIsHtml: true,
        };
      }

      if (clearGeneration.current !== startGeneration) return;
      setResult(next);
      setIsProcessing(false);
      setStepIndex(2);
      showToast("Converted and ready to download");
    } catch (err) {
      console.error(err);
      if (clearGeneration.current !== startGeneration) return;
      setIsProcessing(false);
      showToast("Conversion failed. Double-check the file isn't corrupted and try again.");
    }
  }, [file, inputDef, outputFormat, showToast]);

  const download = useCallback(async () => {
    if (!result) return;
    track("converter_download", {});
    await saveFile(result.filename, result.blob);
  }, [result]);

  const clearAll = useCallback(() => {
    clearGeneration.current++;
    setFile(null);
    setInputDef(null);
    setOutputFormat(null);
    setResult(null);
    setIsProcessing(false);
    setRemoteFetchFailure(null);
    setStepIndex(0);
  }, []);

  const maxReachedIndex = result ? 2 : file ? 1 : 0;

  const goToStep = useCallback(
    (index: number) => {
      if (isProcessing) return;
      if (index <= maxReachedIndex) setStepIndex(index);
    },
    [maxReachedIndex, isProcessing]
  );

  const availableOutputs = useMemo(() => inputDef?.outputs ?? [], [inputDef]);

  return {
    file,
    inputDef,
    outputFormat,
    setOutputFormat,
    availableOutputs,
    result,
    isProcessing,
    stepIndex,
    maxReachedIndex,
    goToStep,
    setInputFile,
    tryFetchRemote,
    isFetchingRemote,
    remoteFetchFailure,
    setRemoteFetchFailure,
    convert,
    download,
    clearAll,
  };
}

export { CONVERTERS };
