import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

export interface LabelEdit {
  x: number;
  y: number;
  text: string;
  onCommit: (text: string) => void;
}

export function LabelEditPopup({ edit, onClose }: { edit: LabelEdit; onClose: () => void }) {
  const [value, setValue] = useState(edit.text);
  const done = useRef(false);
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    if (save) edit.onCommit(value.trim());
    onClose();
  };
  return (
    <div className="fixed z-50 -translate-x-1/2 -translate-y-1/2" style={{ left: edit.x, top: edit.y }}>
      <Input
        autoFocus
        className="h-8 w-56 shadow-lg"
        placeholder="Empty hides the label"
        value={value}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') finish(true);
          if (e.key === 'Escape') finish(false);
        }}
      />
    </div>
  );
}
