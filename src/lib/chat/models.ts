import type { ModelInfo } from './types';

export const AVAILABLE_MODELS: ModelInfo[] = [
  // - Recommended -
  {
    id: "Qwen3-4B-q4f16_1-MLC",
    name: "Qwen 3 4B",
    size: "~3.4 GB",
    speed: "Medium",
    quality: "Very Good",
    recommended: true,
    description: "Best balance of quality and speed. Recommended for most users."
  },

  // - Large (6+ GB VRAM, 7-9B params) -
  {
    id: "Qwen3-8B-q4f16_1-MLC",
    name: "Qwen 3 8B",
    size: "~5.7 GB",
    speed: "Slow",
    quality: "Excellent",
    description: "Latest Qwen 3 with strong reasoning. Needs a powerful GPU."
  },
  {
    id: "gemma-2-9b-it-q4f16_1-MLC",
    name: "Gemma 2 9B",
    size: "~6.4 GB",
    speed: "Slow",
    quality: "Excellent",
    description: "Google's best open model. Excellent instruction following."
  },
  {
    id: "Llama-3.1-8B-Instruct-q4f16_1-MLC",
    name: "Llama 3.1 8B",
    size: "~5.0 GB",
    speed: "Slow",
    quality: "Excellent",
    description: "Meta's flagship 8B model. Top-tier general reasoning."
  },
  {
    id: "DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC",
    name: "DeepSeek R1 8B",
    size: "~5.0 GB",
    speed: "Slow",
    quality: "Excellent",
    description: "DeepSeek R1 distilled into Llama 8B. Strong analytical reasoning."
  },
  {
    id: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
    name: "DeepSeek R1 7B (Qwen)",
    size: "~5.1 GB",
    speed: "Slow",
    quality: "Excellent",
    description: "DeepSeek R1 distilled into Qwen 7B. Great for data analysis."
  },
  {
    id: "Qwen2.5-7B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 7B",
    size: "~5.1 GB",
    speed: "Slow",
    quality: "Excellent",
    description: "Qwen 2.5 large variant. Strong multilingual and analytical ability."
  },
  {
    id: "Hermes-3-Llama-3.1-8B-q4f16_1-MLC",
    name: "Hermes 3 8B",
    size: "~4.9 GB",
    speed: "Slow",
    quality: "Excellent",
    description: "Fine-tuned Llama 3.1 8B for structured outputs and tool use."
  },
  {
    id: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC",
    name: "Mistral 7B v0.3",
    size: "~4.6 GB",
    speed: "Slow",
    quality: "Very Good",
    description: "Mistral's efficient 7B. Good general-purpose reasoning."
  },

  // - Medium (2-5 GB VRAM, 3-4B params) -
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    name: "Phi 3.5 Mini",
    size: "~3.7 GB",
    speed: "Medium",
    quality: "Very Good",
    description: "Microsoft's compact model with strong reasoning and math."
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    name: "Llama 3.2 3B",
    size: "~2.3 GB",
    speed: "Medium",
    quality: "Very Good",
    description: "Meta's compact 3B. Great quality for its size."
  },
  {
    id: "Hermes-3-Llama-3.2-3B-q4f16_1-MLC",
    name: "Hermes 3 3B",
    size: "~2.3 GB",
    speed: "Medium",
    quality: "Very Good",
    description: "Fine-tuned Llama 3.2 3B for structured outputs."
  },
  {
    id: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 3B",
    size: "~2.5 GB",
    speed: "Medium",
    quality: "Very Good",
    description: "Qwen 2.5 mid-size. Good instruction following."
  },
  {
    id: "RedPajama-INCITE-Chat-3B-v1-q4f16_1-MLC",
    name: "RedPajama 3B",
    size: "~3.0 GB",
    speed: "Medium",
    quality: "Good",
    description: "Open-source 3B chat model from Together AI."
  },

  // - Small (1-2 GB VRAM, 1-2B params) -
  {
    id: "Qwen3-1.7B-q4f16_1-MLC",
    name: "Qwen 3 1.7B",
    size: "~2.0 GB",
    speed: "Fast",
    quality: "Good",
    description: "Latest Qwen 3 small model. Fast with good reasoning."
  },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 1.5B",
    size: "~1.6 GB",
    speed: "Fast",
    quality: "Good",
    description: "Compact and efficient. Great for mobile devices."
  },
  {
    id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
    name: "SmolLM2 1.7B",
    size: "~1.8 GB",
    speed: "Fast",
    quality: "Good",
    description: "HuggingFace's efficient small model. Surprisingly capable."
  },
  {
    id: "gemma-2-2b-it-q4f16_1-MLC",
    name: "Gemma 2 2B",
    size: "~1.9 GB",
    speed: "Fast",
    quality: "Good",
    description: "Google's small model with good instruction following."
  },
  {
    id: "stablelm-2-zephyr-1_6b-q4f16_1-MLC",
    name: "StableLM 2 1.6B",
    size: "~2.1 GB",
    speed: "Fast",
    quality: "Good",
    description: "Stability AI's compact chat model."
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    name: "Llama 3.2 1B",
    size: "~0.9 GB",
    speed: "Very Fast",
    quality: "Decent",
    description: "Meta's smallest Llama. Ultra-fast for simple queries."
  },
  {
    id: "phi-1_5-q4f16_1-MLC",
    name: "Phi 1.5",
    size: "~1.2 GB",
    speed: "Very Fast",
    quality: "Decent",
    description: "Microsoft's original small model. Fast and lightweight."
  },

  // - Tiny (<1 GB VRAM, <1B params) -
  {
    id: "Qwen3-0.6B-q4f16_1-MLC",
    name: "Qwen 3 0.6B",
    size: "~1.4 GB",
    speed: "Very Fast",
    quality: "Decent",
    description: "Smallest Qwen 3. Good for basic questions on limited hardware."
  },
  {
    id: "TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC",
    name: "TinyLlama 1.1B",
    size: "~0.7 GB",
    speed: "Fastest",
    quality: "Basic",
    description: "Ultra-lightweight. Best for very limited GPU memory."
  },
  {
    id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    name: "SmolLM2 360M",
    size: "~0.4 GB",
    speed: "Fastest",
    quality: "Basic",
    description: "Extremely small model. Downloads in seconds."
  },
  {
    id: "SmolLM2-135M-Instruct-q0f16-MLC",
    name: "SmolLM2 135M",
    size: "~0.4 GB",
    speed: "Fastest",
    quality: "Minimal",
    description: "Smallest available model. For testing or very constrained devices."
  },
];

export const DEFAULT_MODEL = "Qwen3-4B-q4f16_1-MLC";

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = ['android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
  const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));

  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth < 768;

  return isMobileUA || (hasTouch && isSmallScreen);
}

export function getModelInfo(modelId: string): ModelInfo | undefined {
  return AVAILABLE_MODELS.find(m => m.id === modelId);
}

export const MODEL_GROUPS: Array<{ label: string; filter: (m: ModelInfo) => boolean }> = [
  { label: 'Large (7-9B)', filter: m => m.speed === 'Slow' },
  { label: 'Medium (3-4B)', filter: m => m.speed === 'Medium' },
  { label: 'Small (1-2B)', filter: m => m.speed === 'Fast' },
  { label: 'Tiny (<1B)', filter: m => m.speed === 'Very Fast' || m.speed === 'Fastest' },
];

export function getRecommendedModel(): ModelInfo {
  if (isMobileDevice()) {
    return AVAILABLE_MODELS.find(m => m.id === "Qwen2.5-1.5B-Instruct-q4f16_1-MLC") || AVAILABLE_MODELS[0];
  }
  return AVAILABLE_MODELS.find(m => m.recommended) || AVAILABLE_MODELS[0];
}

export async function checkWebGPUSupport(): Promise<boolean> {
  if (typeof navigator === 'undefined') {
    return false;
  }

  if (!('gpu' in navigator)) {
    return false;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch (error) {
    console.error('WebGPU check failed:', error);
    return false;
  }
}

export function getBrowserCompatibility(): {
  compatible: boolean;
  browser: string;
  message: string;
} {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('chrome') || userAgent.includes('edg')) {
    const version = parseInt(userAgent.match(/chrom(?:e|ium)\/([0-9]+)/)?.[1] || '0');
    if (version >= 113) {
      return {
        compatible: true,
        browser: 'Chrome/Edge',
        message: 'Your browser supports WebLLM with WebGPU.'
      };
    }
    return {
      compatible: false,
      browser: 'Chrome/Edge',
      message: 'Please update to Chrome 113+ or Edge 113+ for WebLLM support.'
    };
  }

  if (userAgent.includes('firefox')) {
    return {
      compatible: false,
      browser: 'Firefox',
      message: 'Firefox does not yet support WebGPU. Please use Chrome or Edge.'
    };
  }

  if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
    return {
      compatible: false,
      browser: 'Safari',
      message: 'Safari does not yet fully support WebGPU. Please use Chrome or Edge.'
    };
  }

  return {
    compatible: false,
    browser: 'Unknown',
    message: 'For best experience, use Chrome 113+ or Edge 113+.'
  };
}
