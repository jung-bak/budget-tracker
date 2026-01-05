import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Transaction, SyncResult, BackfillRequest } from './types';

const API_KEY_STORAGE_KEY = 'budget_tracker_api_key';

// Default to localhost - update this for production
const getBaseUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:8000';
  }
  // For mobile, use your computer's local IP when testing
  // You may need to update this to your actual IP address
  return 'http://localhost:8000';
};

let cachedApiKey: string | null = null;

export const api = {
  async getApiKey(): Promise<string | null> {
    if (cachedApiKey) return cachedApiKey;

    if (Platform.OS === 'web') {
      cachedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    } else {
      cachedApiKey = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
    }
    return cachedApiKey;
  },

  async setApiKey(key: string): Promise<void> {
    cachedApiKey = key;
    if (Platform.OS === 'web') {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } else {
      await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, key);
    }
  },

  async clearApiKey(): Promise<void> {
    cachedApiKey = null;
    if (Platform.OS === 'web') {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    } else {
      await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
    }
  },

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const apiKey = await this.getApiKey();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (apiKey) {
      (headers as Record<string, string>)['X-API-Key'] = apiKey;
    }

    const response = await fetch(`${getBaseUrl()}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 403) {
      throw new ApiError('Invalid or missing API key', 403);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new ApiError(error.detail || 'Request failed', response.status);
    }

    return response.json();
  },

  async getTransactions(): Promise<Transaction[]> {
    return this.request<Transaction[]>('/transactions');
  },

  async syncEmails(): Promise<SyncResult> {
    return this.request<SyncResult>('/sync', { method: 'POST' });
  },

  async backfill(request: BackfillRequest): Promise<SyncResult> {
    return this.request<SyncResult>('/backfill', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async updateTransaction(globalId: string, transaction: Omit<Transaction, 'global_id'>): Promise<Transaction> {
    return this.request<Transaction>(`/transactions/${globalId}`, {
      method: 'PUT',
      body: JSON.stringify(transaction),
    });
  },

  async deleteTransaction(globalId: string): Promise<{ message: string; global_id: string }> {
    return this.request<{ message: string; global_id: string }>(`/transactions/${globalId}`, {
      method: 'DELETE',
    });
  },

  async healthCheck(): Promise<{ status: string; service: string; supported_institutions: string[] }> {
    return this.request('/health');
  },

  async getExchangeRate(): Promise<{ rate: number }> {
    return this.request<{ rate: number }>('/exchange-rate');
  },
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}
