// src/context/DataContext.jsx
import React, { createContext, useContext, useState } from 'react';
import { employmentAPI, mockData } from '../services/api';

// Create data context
const DataContext = createContext();

// Custom hook to use the data context
export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

// Data provider component
export const DataProvider = ({ children }) => {
  const [searchParams, setSearchParams] = useState(null);
  const [employmentData, setEmploymentData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Function to fetch employment history data
  const searchEmploymentHistory = async (params) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // In a real app, this would make an actual API call
      // For demo purposes, we'll use mock data

      // Uncomment this for real API integration
      // const data = await employmentAPI.getEmploymentHistory(params);
      
      // Using mock data for development
      const data = mockData.generateMockEmploymentData(params.identifier);
      
      setEmploymentData(data);
      return data;
    } catch (err) {
      console.error('Error fetching employment data:', err);
      setError(err.message || 'Failed to retrieve employment history data');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Prepare context value
  const contextValue = {
    searchParams,
    setSearchParams,
    employmentData,
    setEmploymentData,
    searchEmploymentHistory,
    isLoading,
    error
  };

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
};