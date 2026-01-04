import { apiRequest } from "./queryClient";
import type { LoginCredentials, User, InsertUser } from "@shared/schema";

export interface AuthResponse {
  token: string;
  user: User;
  message: string;
}

export class AuthService {
  private static TOKEN_KEY = "auth_token";

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiRequest("POST", "/api/auth/login", credentials);
    const data = await response.json();
    this.setToken(data.token);
    return data;
  }

  static async register(userData: InsertUser): Promise<AuthResponse> {
    const response = await apiRequest("POST", "/api/auth/register", userData);
    const data = await response.json();
    this.setToken(data.token);
    return data;
  }

  static async getCurrentUser(): Promise<User> {
    const response = await apiRequest("GET", "/api/auth/me");
    return await response.json();
  }

  static logout(): void {
    this.removeToken();
    // Clear any cached data
    localStorage.clear();
    window.location.href = "/login";
  }

  static isAuthenticated(): boolean {
    return !!this.getToken();
  }
}
