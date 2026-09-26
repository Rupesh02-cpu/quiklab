// mammoth ships no bundled TypeScript types and no @types/mammoth package
// exists on npm, so this declares only the small slice of its API this
// codebase actually calls (src/lib/converters/docx.ts). Widen this if a
// future converter needs more of mammoth's surface.
declare module "mammoth" {
  export interface ConvertResultMessage {
    type: string;
    message: string;
  }

  export interface ConvertResult {
    value: string;
    messages: ConvertResultMessage[];
  }

  export interface ConvertInput {
    arrayBuffer: ArrayBuffer;
  }

  export function convertToHtml(input: ConvertInput): Promise<ConvertResult>;
  export function extractRawText(input: ConvertInput): Promise<ConvertResult>;
}
