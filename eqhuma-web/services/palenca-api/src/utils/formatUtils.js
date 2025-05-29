// src/utils/formatUtils.js
/**
 * Format a date string into a more user-friendly format
 * @param {string} dateString - ISO date string (YYYY-MM-DD)
 * @returns {string} - Formatted date string
 */
export const formatDate = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString;
    }
    
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
};

/**
 * Format a number as currency
 * @param {number} value - Number to format
 * @param {string} currency - Currency code (default: MXN)
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (value, currency = 'MXN') => {
  if (value === undefined || value === null) return '';
  
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency
    }).format(value);
  } catch (error) {
    console.error('Error formatting currency:', error);
    return `${value} ${currency}`;
  }
};

/**
 * Convert weeks to years and remaining weeks
 * @param {number} weeks - Total number of weeks
 * @returns {Object} - Object containing years and remaining weeks
 */
export const weeksToYears = (weeks) => {
  if (typeof weeks !== 'number') {
    return { years: 0, remainingWeeks: 0 };
  }
  
  const years = Math.floor(weeks / 52);
  const remainingWeeks = weeks % 52;
  
  return { years, remainingWeeks };
};

/**
 * Format a name to title case
 * @param {string} name - Name to format
 * @returns {string} - Formatted name
 */
export const formatName = (name) => {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Truncate text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
export const truncateText = (text, maxLength = 30) => {
  if (!text || text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};