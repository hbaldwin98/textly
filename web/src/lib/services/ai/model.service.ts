import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import { AuthorizationService } from '../authorization/authorization.service';
import { env } from '$env/dynamic/public';

export interface ModelCapabilities {
  usesReasoningSuffix: boolean;
  reasoning: boolean;
  internet: boolean;
  standard: boolean;
}

// Server DTO interface
interface AIModelDTO {
  id: string;
  identifier: string;
  name: string;
  description: string;
  icon: string;
  capabilities: string[];
  provider: string;
  default: boolean;
  created: string;
  updated: string;
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  icon: string;
  capabilities: ModelCapabilities;
  provider: string;
  default: boolean;
}

export interface ModelConfig {
  models: AIModel[];
}

export interface ModelState {
  availableModels: AIModel[];
  selectedModel: AIModel | null;
  isLoading: boolean;
  error: string | null;
  capabilityOverrides: { [modelId: string]: Partial<ModelCapabilities> };
}

class ModelService {
  private static instance: ModelService;
  private store: Writable<ModelState>;
  private static readonly STORAGE_KEY_SELECTED_MODEL = 'textly_selected_model';
  private static readonly STORAGE_KEY_CAPABILITY_OVERRIDES = 'textly_capability_overrides';
  private authService: AuthorizationService;

  private constructor() {
    this.authService = AuthorizationService.getInstance();
    this.store = writable<ModelState>({
      availableModels: [],
      selectedModel: null,
      isLoading: false,
      error: null,
      capabilityOverrides: this.loadCapabilityOverridesFromStorage()
    });
  }

  public static getInstance(): ModelService {
    if (!ModelService.instance) {
      ModelService.instance = new ModelService();
    }
    return ModelService.instance;
  }

  public getStore() {
    return this.store;
  }

  // Convert server DTO to client model
  private convertDTOToModel(dto: AIModelDTO): AIModel {
    // Convert string array capabilities to ModelCapabilities object
    const capabilities: ModelCapabilities = {
      reasoning: (dto?.capabilities?.includes('reasoning') || dto?.capabilities?.includes('reasoningsuffix')) ?? false,
      usesReasoningSuffix: dto?.capabilities?.includes('reasoningsuffix') ?? false,
      internet: dto?.capabilities?.includes('internet') ?? false,
      standard: true,
    };

    return {
      id: dto.identifier, // Use identifier as the model ID
      name: dto.name,
      description: dto.description,
      icon: dto.icon,
      capabilities: capabilities,
      provider: dto.provider,
      default: dto.default
    };
  }

  public async loadModels(): Promise<void> {
    try {
      this.store.update(state => ({ ...state, isLoading: true, error: null }));

      // Check authentication first
      if (!this.authService.token) {
        // If not authenticated, just load static models
        const models = await this.loadModelsFromStatic();
        const selectedModel = models.find(m => m.default) || models[0] || null;

        this.store.update(state => ({
          ...state,
          availableModels: models,
          selectedModel: selectedModel,
          isLoading: false
        }));
        return;
      }

      // Try to load from server first
      let models: AIModel[] = [];
      try {
        models = await this.loadModelsFromServer();
      } catch (serverError) {
        console.warn('Failed to load models from server, falling back to static config:', serverError);
        // Fallback to static configuration
        models = await this.loadModelsFromStatic();
      }

      // Find default model or use first one
      const savedModelId = this.loadSelectedModelFromStorage();
      let selectedModel: AIModel | null = null;

      if (savedModelId) {
        // Try to find the saved model
        selectedModel = models.find(m => m.id === savedModelId) || null;
      }

      // Fallback to default model or first one if saved model not found
      if (!selectedModel) {
        selectedModel = models.find(m => m.default) || models[0] || null;
      }

      this.store.update(state => ({
        ...state,
        availableModels: models,
        selectedModel: selectedModel,
        isLoading: false
      }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load models';
      this.store.update(state => ({
        ...state,
        error: errorMessage,
        isLoading: false
      }));
      throw new Error(errorMessage);
    }
  }

  private async loadModelsFromServer(): Promise<AIModel[]> {
    const response = await fetch(`${env.PUBLIC_POCKETBASE_URL}/ai/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AuthorizationService.getInstance().token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load models from server');
    }

    const data = await response.json();
    // Convert DTOs to client models
    return data.models.map((dto: AIModelDTO) => this.convertDTOToModel(dto));
  }

  private async loadModelsFromStatic(): Promise<AIModel[]> {
    const response = await fetch('/ai-models.json');

    if (!response.ok) {
      throw new Error('Failed to load static model configuration');
    }

    const config: ModelConfig = await response.json();
    return config.models;
  }

  public selectModel(modelId: string): void {
    this.store.update(state => {
      const model = state.availableModels.find(m => m.id === modelId);
      if (!model) {
        return { ...state, error: 'Model not found' };
      }

      // Clear capability overrides for capabilities the new model doesn't support
      const currentOverrides = state.capabilityOverrides[modelId] || {};
      const validOverrides: Partial<ModelCapabilities> = {};

      // Only keep overrides for capabilities the model actually supports
      Object.entries(currentOverrides).forEach(([capability, value]) => {
        const capKey = capability as keyof ModelCapabilities;
        if (model?.capabilities[capKey]) {
          validOverrides[capKey] = value;
        }
      });

      const newCapabilityOverrides = {
        ...state.capabilityOverrides,
        [modelId]: validOverrides
      };

      // Save to local storage
      this.saveSelectedModelToStorage(modelId);
      this.saveCapabilityOverridesToStorage(newCapabilityOverrides);

      return {
        ...state,
        selectedModel: model,
        error: null,
        capabilityOverrides: newCapabilityOverrides
      };
    });
  }

  public getSelectedModel(): AIModel | null {
    let selectedModel: AIModel | null = null;
    const unsubscribe = this.store.subscribe(state => {
      selectedModel = state.selectedModel;
    });
    unsubscribe();
    return selectedModel;
  }

  public getCapabilityIcon(capability: keyof ModelCapabilities): string {
    switch (capability) {
      case 'reasoning':
        return '🧠';
      case 'internet':
        return '🌐';
      case 'standard':
        return '💬';
      default:
        return '❓';
    }
  }

  public getCapabilityLabel(capability: keyof ModelCapabilities): string {
    switch (capability) {
      case 'reasoning':
        return 'Advanced Reasoning';
      case 'internet':
        return 'Internet Access';
      case 'standard':
        return 'Standard Chat';
      default:
        return 'Unknown';
    }
  }

  public setCapabilityOverride(modelId: string, capability: keyof ModelCapabilities, enabled: boolean): void {
    this.store.update(state => {
      const currentOverrides = state.capabilityOverrides[modelId] || {};
      const newCapabilityOverrides = {
        ...state.capabilityOverrides,
        [modelId]: {
          ...currentOverrides,
          [capability]: enabled
        }
      };

      // Save to local storage
      this.saveCapabilityOverridesToStorage(newCapabilityOverrides);

      return {
        ...state,
        capabilityOverrides: newCapabilityOverrides
      };
    });
  }

  public getEffectiveCapabilities(modelId: string): ModelCapabilities | null {
    let state: ModelState;
    const unsubscribe = this.store.subscribe(s => state = s);
    unsubscribe();

    const model = state!.availableModels.find(m => m.id === modelId);
    if (!model) return null;

    const overrides = state!.capabilityOverrides[modelId] || {};

    // Start with all capabilities disabled by default
    // Only enable capabilities that the user has explicitly overridden to true
    return {
      usesReasoningSuffix: model.capabilities?.usesReasoningSuffix,
      reasoning: overrides?.reasoning === true,
      internet: overrides?.internet === true,
      standard: true
    };
  }

  public getEffectiveModelId(modelId: string): string {
    const capabilities = this.getEffectiveCapabilities(modelId);
    if (!capabilities) return modelId;

    let effectiveId = modelId;

    // Add :online suffix if internet capability is enabled
    if (capabilities.internet) {
      effectiveId += ':online';
    }

    if (capabilities.reasoning && capabilities.usesReasoningSuffix) {
      effectiveId += ':thinking';
    }

    return effectiveId;
  }

  public shouldUseReasoning(modelId?: string): boolean {
    const targetModelId = modelId || this.getSelectedModel()?.id;
    if (!targetModelId) return false;

    const capabilities = this.getEffectiveCapabilities(targetModelId);
    return capabilities?.reasoning || false;
  }

  private loadCapabilityOverridesFromStorage(): { [modelId: string]: Partial<ModelCapabilities> } {
    if (!browser) return {};

    try {
      const stored = localStorage.getItem(ModelService.STORAGE_KEY_CAPABILITY_OVERRIDES);
      return stored ? JSON.parse(stored) : {};
    } catch (err) {
      console.warn('Failed to load capability overrides from storage:', err);
      return {};
    }
  }

  private saveCapabilityOverridesToStorage(overrides: { [modelId: string]: Partial<ModelCapabilities> }): void {
    if (!browser) return;

    try {
      localStorage.setItem(ModelService.STORAGE_KEY_CAPABILITY_OVERRIDES, JSON.stringify(overrides));
    } catch (err) {
      console.warn('Failed to save capability overrides to storage:', err);
    }
  }

  private loadSelectedModelFromStorage(): string | null {
    if (!browser) return null;

    try {
      return localStorage.getItem(ModelService.STORAGE_KEY_SELECTED_MODEL);
    } catch (err) {
      console.warn('Failed to load selected model from storage:', err);
      return null;
    }
  }

  private saveSelectedModelToStorage(modelId: string): void {
    if (!browser) return;

    try {
      localStorage.setItem(ModelService.STORAGE_KEY_SELECTED_MODEL, modelId);
    } catch (err) {
      console.warn('Failed to save selected model to storage:', err);
    }
  }
}

export const modelService = ModelService.getInstance();
export const modelStore = modelService.getStore(); 