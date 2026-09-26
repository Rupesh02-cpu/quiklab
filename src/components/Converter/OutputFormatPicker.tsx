"use client";

import type { ConverterOutputFormat, ConverterOutputOption } from "@/lib/converters/registry";

interface OutputFormatPickerProps {
  readonly options: ConverterOutputOption[];
  readonly value: ConverterOutputFormat | null;
  readonly onChange: (format: ConverterOutputFormat) => void;
}

export function OutputFormatPicker({ options, value, onChange }: OutputFormatPickerProps) {
  const selected = options.find((o) => o.format === value);
  return (
    <div className="field">
      <label htmlFor="outputFormat">Convert to</label>
      <select id="outputFormat" value={value ?? ""} onChange={(e) => onChange(e.target.value as ConverterOutputFormat)}>
        {options.map((option) => (
          <option key={option.format} value={option.format}>
            {option.label}
          </option>
        ))}
      </select>
      {selected?.lossNote && <p className="field-hint">{selected.lossNote}</p>}
    </div>
  );
}
