import * as crypto from 'crypto';

/**
 * Dropbox OAuth Service
 * Handles OAuth 2.0 flow for Dropbox cloud storage
 */

const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY || '';
const DROPBOX_REDIRECT_URI = 'http://localhost:3001/oauth/dropbox';
const DROPBOX_AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const DROPBOX_API_URL = 'https://api.dropboxapi.com/2';

interface DropboxTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

class DropboxOAuthService {
  private tokens: DropboxTokens | null = null;

  /**
   * Start OAuth flow - returns authorization URL
   */
  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: DROPBOX_APP_KEY,
      redirect_uri: DROPBOX_REDIRECT_URI,
      response_type: 'code',
      token_access_type: 'offline', // Get refresh token
    });
    return `${DROPBOX_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCode(code: string): Promise<DropboxTokens> {
    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: DROPBOX_APP_KEY,
        redirect_uri: DROPBOX_REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      throw new Error(`Dropbox token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    };
    return this.tokens;
  }

  /**
   * Get valid access token
   */
  async getValidAccessToken(): Promise<string> {
    if (!this.tokens) {
      throw new Error('Not authenticated with Dropbox');
    }
    
    // Check if expired
    if (this.tokens.expiresAt && Date.now() > this.tokens.expiresAt) {
      if (this.tokens.refreshToken) {
        await this.refreshAccessToken();
      } else {
        throw new Error('Dropbox access token expired');
      }
    }
    
    return this.tokens.accessToken;
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.tokens.refreshToken,
        client_id: DROPBOX_APP_KEY,
      }),
    });

    if (!response.ok) {
      throw new Error(`Dropbox token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.tokens.accessToken = data.access_token;
    this.tokens.expiresAt = data.expires_in ? Date.now() + data.expires_in * 1000 : undefined;
  }

  /**
   * Save tokens to storage
   */
  saveTokens(tokens: DropboxTokens): void {
    this.tokens = tokens;
    console.log('[Dropbox OAuth] Tokens saved');
  }

  /**
   * Get current tokens
   */
  getTokens(): DropboxTokens | null {
    return this.tokens;
  }

  /**
   * Logout - clear tokens
   */
  deleteTokens(): void {
    this.tokens = null;
    console.log('[Dropbox OAuth] Tokens cleared');
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.tokens !== null && !!this.tokens.accessToken;
  }
}

export const dropboxOAuthService = new DropboxOAuthService();
export default DropboxOAuthService;
