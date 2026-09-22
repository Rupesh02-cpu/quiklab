"use client";

interface CompressFormProps {
  readonly quality: number;
  readonly onChange: (quality: number) => void;
}

export function CompressForm({ quality, onChange }: CompressFormProps) {
  return (
    <div className="pdf-watermark-form">
      <div className="field">
        <label htmlFor="compressQuality">
          Image quality <span className="mono">{quality}</span>
        </label>
        <input
          type="range"
          id="compressQuality"
          min={20}
          max={90}
          value={quality}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
