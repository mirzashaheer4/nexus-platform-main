import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  withCredentials: true, // Send/receive httpOnly cookies automatically
});

// No Authorization header interceptor — auth is handled via httpOnly cookies.

export default API;
