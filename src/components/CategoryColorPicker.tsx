import React from 'react';
import { type CategoryColorMapping } from '@/lib/categoricalUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface CategoryColorPickerProps {
  categories: string[];
  colorMapping: CategoryColorMapping;
  onColorChange: (category: string, color: string) => void;
}

export const CategoryColorPicker: React.FC<CategoryColorPickerProps> = ({
  categories,
  colorMapping,
  onColorChange,
}) => {
  if (categories.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Category Colors</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
          {categories.map((category) => (
            <div key={category} className="flex items-center gap-2">
              <input
                type="color"
                value={colorMapping[category] || '#cccccc'}
                onChange={(e) => onColorChange(category, e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-[hsl(35,18%,78%)] dark:border-[hsl(25,8%,20%)]"
                aria-label={`Color for ${category}`}
              />
              <Label className="text-sm flex-1 truncate" title={category}>
                {category}
              </Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
