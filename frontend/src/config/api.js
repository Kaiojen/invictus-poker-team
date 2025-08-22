// src/config/api.js
// Configuração da API para desenvolvimento e produção

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

console.log('🔗 API Base URL:', API_BASE_URL);

// Função helper para fazer requisições à API
export const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions = {
    credentials: 'include', // Importante para cookies de sessão
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  const requestOptions = { ...defaultOptions, ...options };

  try {
    console.log(`📡 API Request: ${requestOptions.method || 'GET'} ${url}`);
    const response = await fetch(url, requestOptions);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ API Error:', response.status, errorData);
      throw new Error(`HTTP ${response.status}: ${errorData}`);
    }
    
    const data = await response.json();
    console.log('✅ API Response:', data);
    return data;
  } catch (error) {
    console.error('❌ API Request Failed:', error);
    throw error;
  }
};

// Helper para GET requests
export const apiGet = (endpoint) => apiRequest(endpoint);

// Helper para POST requests
export const apiPost = (endpoint, data) => 
  apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });

// Helper para PUT requests
export const apiPut = (endpoint, data) => 
  apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

// Helper para DELETE requests
export const apiDelete = (endpoint) => 
  apiRequest(endpoint, {
    method: 'DELETE',
  });

export default API_BASE_URL;
