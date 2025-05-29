// src/services/api.js
const API_BASE_URL = 'https://api.example.com/v1'; // Replace with actual API base URL when available

// Helper for managing tokens
const getAuthToken = () => localStorage.getItem('auth_token');
const setAuthToken = (token) => localStorage.setItem('auth_token', token);
const removeAuthToken = () => localStorage.removeItem('auth_token');

// Helper for HTTP requests with authentication
const authFetch = async (endpoint, options = {}) => {
  const token = getAuthToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const config = {
    ...options,
    headers,
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

// Authentication API endpoints
export const authAPI = {
  // Login user with email and password
  login: async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Login failed. Please check your credentials.');
      }
      
      const data = await response.json();
      setAuthToken(data.token);
      
      return {
        token: data.token,
        user: data.user,
        expiresAt: data.expires_at,
      };
    } catch (error) {
      console.error('Login Error:', error);
      throw error;
    }
  },
  
  // Log out user (clear tokens)
  logout: () => {
    removeAuthToken();
    return true;
  },
  
  // Check if user is authenticated (token exists)
  isAuthenticated: () => {
    return Boolean(getAuthToken());
  }
};

// Employment data API endpoints
export const employmentAPI = {
  // Get employment history based on search parameters
  getEmploymentHistory: async (params) => {
    const queryParams = new URLSearchParams();
    
    // Add parameters to query string
    if (params.identifier) queryParams.append('identifier', params.identifier);
    if (params.startDate) queryParams.append('start_date', params.startDate);
    if (params.endDate) queryParams.append('end_date', params.endDate);
    if (params.employer) queryParams.append('employer', params.employer);
    if (params.region) queryParams.append('region', params.region);
    if (params.page) queryParams.append('page', params.page);
    if (params.pageSize) queryParams.append('page_size', params.pageSize);
    
    const endpoint = `/employment/history?${queryParams.toString()}`;
    return await authFetch(endpoint);
  }
};

// Report generation API endpoints
export const reportAPI = {
  // Generate report in PDF or Excel format
  generateReport: async (params) => {
    const endpoint = '/reports/generate';
    const options = {
      method: 'POST',
      body: JSON.stringify({
        identifier: params.identifier,
        start_date: params.startDate,
        end_date: params.endDate,
        format: params.format,
        include_details: params.includeDetails || true
      }),
    };
    
    return await authFetch(endpoint, options);
  },
  
  // Download a report using the provided URL
  downloadReport: async (reportUrl) => {
    try {
      const token = getAuthToken();
      const fullUrl = reportUrl.startsWith('http') ? reportUrl : `${API_BASE_URL}${reportUrl}`;
      
      const response = await fetch(fullUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to download report');
      }
      
      return await response.blob();
    } catch (error) {
      console.error('Download Error:', error);
      throw error;
    }
  }
};

// Mock data for development purposes (to be removed in production)
export const mockData = {
  generateMockEmploymentData: (identifier) => {
    return {
      user_info: {
        name: "Victor Hugo Olvera Cruz",
        nss: "04846999364",
        curp: identifier || "OOVC671225HDFLRC09"
      },
      employment_records: [
        {
          employer: "TECNOLOGIA Y MANUFACTURA SA DE CV",
          start_date: "2021-09-01",
          end_date: "2022-12-31",
          position: "Technical Specialist",
          weeks_contributed: 69
        },
        {
          employer: "SERVICIO DE ADMINISTRACION TRIBUTARIA",
          start_date: "2020-05-15",
          end_date: "2021-08-30",
          position: "Administrative Support",
          weeks_contributed: 67
        },
        {
          employer: "INSTITUTO NACIONAL ELECTORAL",
          start_date: "2019-03-01",
          end_date: "2020-04-30",
          position: "Technical Coordinator",
          weeks_contributed: 61
        },
        {
          employer: "SECRETARIA DE HACIENDA Y CREDITO PUBLICO",
          start_date: "2018-01-15",
          end_date: "2019-02-28",
          position: "Systems Analyst",
          weeks_contributed: 58
        }
      ],
      summary: {
        total_records: 4,
        total_weeks_contributed: 255,
        total_years: 4.9
      },
      pagination: {
        current_page: 1,
        total_pages: 1,
        page_size: 20
      }
    };
  }
};