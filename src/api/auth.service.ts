import apiClient from './client';
import { Endpoints } from './endpoints';
import { AuthResponse, LoginRequest, RegisterRequest, User } from '../types';

export const AuthService = {
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<any>(Endpoints.auth.login, credentials);
    if (response.data && response.data.success && response.data.data) {
      return response.data.data as AuthResponse;
    }
    return response.data as AuthResponse;
  },


  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<any>(Endpoints.auth.register, data);
    if (response.data && response.data.success && response.data.data) {
      return response.data.data as AuthResponse;
    }
    return response.data as AuthResponse;
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<any>(Endpoints.auth.me);
    if (response.data && response.data.success && response.data.data) {
      return response.data.data as User;
    }
    return response.data as User;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await apiClient.post<any>(Endpoints.auth.forgotPassword, { email });
    if (response.data && response.data.success && response.data.data) {
      return response.data.data;
    }
    return response.data;
  },

  updateProfile: async (userId: number, data: Partial<User>): Promise<User> => {
    const response = await apiClient.post<any>(Endpoints.auth.updateProfile, data);
    if (response.data && response.data.success && response.data.data) {
      return response.data.data as User;
    }
    return response.data as User;
  },

  deleteAccount: async (): Promise<{ message: string }> => {
    const response = await apiClient.post<any>(Endpoints.auth.deleteAccount);
    if (response.data && response.data.success && response.data.data) {
      return response.data.data;
    }
    return response.data;
  },
};
