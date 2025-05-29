/**
 * Obtiene los parámetros de paginación de la consulta
 * @param {Object} query - Query params de la petición
 * @returns {Object} Objeto con parámetros de paginación
 */
exports.getPagination = (query) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip
  };
};

/**
 * Genera los enlaces de paginación
 * @param {string} baseUrl - URL base para los enlaces
 * @param {number} page - Página actual
 * @param {number} limit - Límite de elementos por página
 * @param {number} total - Total de elementos
 * @returns {Object} Objeto con enlaces de paginación
 */
exports.getPaginationLinks = (baseUrl, page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  const links = {};

  // Enlace a la primera página
  links.first = `${baseUrl}?page=1&limit=${limit}`;
  
  // Enlace a la última página
  links.last = `${baseUrl}?page=${totalPages}&limit=${limit}`;

  // Enlace a la página anterior
  if (page > 1) {
    links.prev = `${baseUrl}?page=${page - 1}&limit=${limit}`;
  }

  // Enlace a la página siguiente
  if (page < totalPages) {
    links.next = `${baseUrl}?page=${page + 1}&limit=${limit}`;
  }

  return links;
};

/**
 * Valida los parámetros de paginación
 * @param {number} page - Número de página
 * @param {number} limit - Límite de elementos por página
 * @returns {boolean} True si los parámetros son válidos
 */
exports.validatePaginationParams = (page, limit) => {
  if (page < 1 || limit < 1) {
    return false;
  }
  
  // Establecer un límite máximo para prevenir sobrecarga
  const MAX_LIMIT = 100;
  if (limit > MAX_LIMIT) {
    return false;
  }

  return true;
};

/**
 * Calcula metadatos de paginación
 * @param {number} total - Total de elementos
 * @param {number} page - Página actual
 * @param {number} limit - Límite de elementos por página
 * @returns {Object} Objeto con metadatos de paginación
 */
exports.getPaginationMetadata = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    currentPage: page,
    itemsPerPage: limit,
    totalItems: total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
};

/**
 * Aplica paginación a una consulta de Mongoose
 * @param {Object} query - Query de Mongoose
 * @param {Object} options - Opciones de paginación
 * @returns {Object} Query modificado con paginación
 */
exports.applyPagination = (query, { page, limit }) => {
  return query.skip((page - 1) * limit).limit(limit);
};
