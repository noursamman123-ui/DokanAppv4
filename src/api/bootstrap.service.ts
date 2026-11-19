import apiClient from './client';
import { Endpoints } from './endpoints';
import { BootstrapData } from '../types';

export const BootstrapService = {
  getBootstrapData: async (signal?: AbortSignal): Promise<BootstrapData> => {
    const response = await apiClient.get<any>(Endpoints.home.bootstrap, { signal });

    if (response.data?.success && response.data?.data) {
      return response.data.data as BootstrapData;
    }

    return response.data as BootstrapData;
  },
};
