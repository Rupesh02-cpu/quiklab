"use client";

import type { WatermarkSettings } from "@/lib/pdfTypes";

interface WatermarkFormProps {
  readonly settings: WatermarkSettings;
  readonly onChange: (patch: Partial<WatermarkSettings>) => void;
}

export function WatermarkForm({ settings, onChange }: WatermarkFormProps) {
  return (
    <div className="pdf-watermark-form">
      <div className="field">
        <label htmlFor="wmText">Watermark text</label>
        <input
          type="text"
          id="wmText"
          value={settings.text}
          maxLength={60}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="wmPosition">Position</label>
        <select
          id="wmPosition"
          value={settings.position}
          onChange={(e) => onChange({ position: e.target.value as WatermarkSettings["position"] })}
        >
          <option value="center">Center, diagonal</option>
          <option value="tile">Tiled, diagonal</option>
          <option value="bottom">Bottom center</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="wmOpacity">
          Opacity <span className="mono">{settings.opacity}</span>%
        </label>
        <input
          type="range"
          id="wmOpacity"
          min={5}
          max={80}
          value={settings.opacity}
          onChange={(e) => onChange({ opacity: Number(e.target.value) })}
        />
      </div>
      <div className="field">
        <label htmlFor="wmSize">
          Font size <span className="mono">{settings.size}</span>px
        </label>
        <input
          type="range"
          id="wmSize"
          min={16}
          max={120}
          value={settings.size}
          onChange={(e) => onChange({ size: Number(e.target.value) })}
        />
      </div>
      <div className="field">
        <label htmlFor="wmColor">Color</label>
        <select
          id="wmColor"
          value={settings.color}
          onChange={(e) => onChange({ color: e.target.value as WatermarkSettings["color"] })}
        >
          <option value="gray">Gray</option>
          <option value="red">Red</option>
          <option value="black">Black</option>
        </select>
      </div>
    </div>
  );
}
