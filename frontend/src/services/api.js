const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  getToken() {
    return localStorage.getItem('token');
  }

  setToken(token) {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const error = new Error(data?.error?.message || response.statusText || 'Request failed');
        error.status = response.status;
        error.details = data?.error?.details;
        throw error;
      }

      return data?.data !== undefined ? data.data : data;
    } catch (err) {
      throw err;
    }
  }

  // Auth Endpoints
  async register(name, email, password) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  }

  async login(email, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe() {
    return this.request('/api/auth/me', {
      method: 'GET',
    });
  }

  // Conversation Endpoints
  async createConversation(initialMessage) {
    return this.request('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ initialMessage }),
    });
  }

  async getConversations(params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = `/api/conversations${query ? `?${query}` : ''}`;
    return this.request(endpoint, {
      method: 'GET',
    });
  }

  async getConversation(id) {
    return this.request(`/api/conversations/${id}`, {
      method: 'GET',
    });
  }

  async claimConversation(id) {
    return this.request(`/api/conversations/${id}/assign`, {
      method: 'PATCH',
    });
  }

  async updateConversationStatus(id, status) {
    return this.request(`/api/conversations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // Message Endpoints
  async getMessages(conversationId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = `/api/conversations/${conversationId}/messages${query ? `?${query}` : ''}`;
    return this.request(endpoint, {
      method: 'GET',
    });
  }

  async sendMessage(conversationId, content, clientMessageId) {
    return this.request(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, clientMessageId }),
    });
  }

  async markAsRead(conversationId) {
    return this.request(`/api/conversations/${conversationId}/messages/read`, {
      method: 'PATCH',
    });
  }
}

export const api = new ApiClient();
