// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { authAPI } from '../services/api';

// Create the authentication context
const AuthContext = createContext();

// Custom hook to use the authentication context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Authentication provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing authentication on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      setIsLoading(true);
      try {
        // Check if user is already authenticated
        const isLoggedIn = authAPI.isAuthenticated();
        
        if (isLoggedIn) {
          // For now, we'll create a mock user since we don't have a token verification endpoint
          // In a real app, you would fetch the user profile from an API here
          setUser({
            id: 'user123',
            name: 'User',
            email: 'user@example.com'
          });
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Login function
  const login = async (email, password) => {
    setIsLoading(true);
    try {
      // In a real app, this would make an actual API call
      // For demo purposes, we'll simulate a successful login with mock data
      
      // Uncomment this for real API integration
      // const authData = await authAPI.login(email, password);
      // setUser(authData.user);
      
      // Mock user for demo
      const mockUser = {
        id: 'user123',
        name: 'User',
        email: email
      };
      
      // Set mock auth token
      localStorage.setItem('auth_token', 'mock_token_123');
      
      // Update state
      setUser(mockUser);
      setIsAuthenticated(true);
      return mockUser;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    authAPI.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  // Prepare context value
  const contextValue = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};