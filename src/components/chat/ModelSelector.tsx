import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { CheckCircle2, XCircle, Loader2, Smartphone } from 'lucide-react';
import { AVAILABLE_MODELS, MODEL_GROUPS, checkWebGPUSupport, getBrowserCompatibility, isMobileDevice, getRecommendedModel } from '@/lib/chat/models';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ModelInfo } from '@/lib/chat/types';

interface ModelSelectorProps {
  onSelectModel: (modelId: string) => void;
  onCancel?: () => void;
}

export function ModelSelector({ onSelectModel, onCancel }: ModelSelectorProps) {
  const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null);
  const [browserInfo, setBrowserInfo] = useState<ReturnType<typeof getBrowserCompatibility> | null>(null);
  const [checking, setChecking] = useState(true);
  const isMobileViewport = useIsMobile();

  useEffect(() => {
    async function checkSupport() {
      setChecking(true);
      const supported = await checkWebGPUSupport();
      const browser = getBrowserCompatibility();

      setWebGPUSupported(supported);
      setBrowserInfo(browser);
      setChecking(false);
    }

    checkSupport();
  }, []);

  if (checking) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Checking browser compatibility...</span>
      </div>
    );
  }

  const isMobile = isMobileDevice();
  const recommended = getRecommendedModel();

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold mb-2">Choose AI Model</h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          Select an AI model to power the chat assistant. The model will be downloaded once and cached for future use.
        </p>
      </div>

      {isMobile && (
        <Alert>
          <Smartphone className="h-4 w-4" />
          <AlertDescription>
            <strong>Mobile Device Detected</strong>
            <p className="mt-1 text-sm">
              We recommend a small model (1.5B or less) for mobile devices. Qwen 2.5 1.5B offers the best balance of quality and speed on mobile hardware.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {browserInfo && (
        <Alert variant={browserInfo.compatible ? "default" : "destructive"}>
          <div className="flex items-start gap-2">
            {browserInfo.compatible ? (
              <CheckCircle2 className="h-5 w-5 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 mt-0.5" />
            )}
            <AlertDescription>
              <strong>{browserInfo.browser}:</strong> {browserInfo.message}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {!webGPUSupported && (
        <Alert variant="destructive">
          <XCircle className="h-5 w-5" />
          <AlertDescription>
            <strong>WebGPU not supported</strong>
            <p className="mt-1 text-sm">
              Your browser or device doesn't support WebGPU, which is required for running local AI models.
              Please use a recent version of Chrome (113+) or Edge (113+) on a device with GPU support.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {isMobileViewport ? (
        <MobileModelDropdown
          onSelect={onSelectModel}
          disabled={!webGPUSupported}
          recommendedId={recommended.id}
        />
      ) : (
        <div className="space-y-4">
          {AVAILABLE_MODELS.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              onSelect={() => onSelectModel(model.id)}
              disabled={!webGPUSupported}
            />
          ))}
        </div>
      )}

      <Alert>
        <AlertDescription>
          <p className="font-semibold mb-2 text-sm sm:text-base">What happens when you select a model?</p>
          <ul className="text-xs sm:text-sm space-y-1 list-disc list-inside">
            <li>The model will be downloaded once (0.4-6.4 GB depending on choice)</li>
            <li>Download is cached in your browser for future use</li>
            <li>Everything runs locally - no data sent to external servers</li>
            <li>You can change models later from the chat settings</li>
          </ul>
        </AlertDescription>
      </Alert>

      {onCancel && (
        <Button variant="outline" onClick={onCancel} className="w-full">
          Cancel
        </Button>
      )}
    </div>
  );
}

interface MobileModelDropdownProps {
  onSelect: (modelId: string) => void;
  disabled?: boolean;
  recommendedId: string;
}

function MobileModelDropdown({ onSelect, disabled, recommendedId }: MobileModelDropdownProps) {
  const [selectedId, setSelectedId] = useState(recommendedId);
  const selectedModel = AVAILABLE_MODELS.find(m => m.id === selectedId);

  return (
    <div className="space-y-3">
      <Select value={selectedId} onValueChange={setSelectedId} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          {MODEL_GROUPS.map(group => {
            const models = AVAILABLE_MODELS.filter(group.filter);
            if (models.length === 0) return null;
            return (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {models.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} - {m.size}
                    {m.id === recommendedId ? ' *' : ''}
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>

      {selectedModel && (
        <Card className="border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm">{selectedModel.name}</span>
              {selectedModel.id === recommendedId && (
                <Badge variant="default" className="text-xs py-0">Recommended</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-2">{selectedModel.description}</p>
            <div className="flex gap-3 text-xs mb-3">
              <span><strong>Size:</strong> {selectedModel.size}</span>
              <span><strong>Speed:</strong> {selectedModel.speed}</span>
              <span><strong>Quality:</strong> {selectedModel.quality}</span>
            </div>
            <Button
              onClick={() => onSelect(selectedId)}
              disabled={disabled}
              size="sm"
              className="w-full"
            >
              Download & Use {selectedModel.name}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ModelCardProps {
  model: ModelInfo;
  onSelect: () => void;
  disabled?: boolean;
}

function ModelCard({ model, onSelect, disabled }: ModelCardProps) {
  const isMobile = isMobileDevice();
  const isMobileRecommended = isMobile && model.id === "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

  return (
    <Card className={model.recommended || isMobileRecommended ? 'border-primary border-2' : ''}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h3 className="font-semibold text-base sm:text-lg">{model.name}</h3>
              {(model.recommended && !isMobile) && (
                <Badge variant="default">Recommended</Badge>
              )}
              {isMobileRecommended && (
                <Badge variant="default">
                  <Smartphone className="h-3 w-3 mr-1" />
                  Mobile
                </Badge>
              )}
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground mb-3">
              {model.description}
            </p>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 text-xs sm:text-sm">
              <div>
                <div className="font-medium text-muted-foreground">Size</div>
                <div className="truncate">{model.size}</div>
              </div>
              <div>
                <div className="font-medium text-muted-foreground">Speed</div>
                <div className="truncate">{model.speed.split(' ')[0]}</div>
              </div>
              <div>
                <div className="font-medium text-muted-foreground">Quality</div>
                <div className="truncate">{model.quality}</div>
              </div>
            </div>
          </div>

          <Button
            onClick={onSelect}
            disabled={disabled}
            variant={(model.recommended && !isMobile) || isMobileRecommended ? "default" : "outline"}
            className="w-full sm:w-auto"
          >
            Select
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
