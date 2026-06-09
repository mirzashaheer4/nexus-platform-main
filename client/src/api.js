import axios from 'axios';

let apiURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Normalize base URL: ensure it ends with '/api' (with or without trailing slash)
if (apiURL && !apiURL.endsWith('/api') && !apiURL.endsWith('/api/')) {
  apiURL = apiURL.endsWith('/') ? `${apiURL}api` : `${apiURL}/api`;
}

const API = axios.create({
  baseURL: apiURL,
  withCredentials: true, // Send/receive httpOnly cookies automatically
});

// No Authorization header interceptor — auth is handled via httpOnly cookies.

export default API;
