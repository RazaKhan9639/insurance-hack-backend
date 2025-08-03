const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api';

const testAPI = async () => {
  try {
    console.log('Testing API endpoints...\n');

    // Test health check
    console.log('1. Testing health check...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Health check:', healthResponse.data);

    // Test registration
    console.log('\n2. Testing user registration...');
    const registerData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      phone: '1234567890',
      country: 'Test Country'
    };

    try {
      const registerResponse = await axios.post(`${API_BASE_URL}/auth/register`, registerData);
      console.log('✅ Registration successful:', registerResponse.data);
    } catch (error) {
      if (error.response?.data) {
        console.log('❌ Registration failed:', error.response.data);
      } else {
        console.log('❌ Registration failed:', error.message);
      }
    }

    // Test login
    console.log('\n3. Testing login...');
    const loginData = {
      email: 'test@example.com',
      password: 'password123'
    };

    try {
      const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, loginData);
      console.log('✅ Login successful:', loginResponse.data);
      
      // Test profile with token
      const token = loginResponse.data.data.token;
      console.log('\n4. Testing profile endpoint...');
      const profileResponse = await axios.get(`${API_BASE_URL}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Profile fetch successful:', profileResponse.data);
      
    } catch (error) {
      if (error.response?.data) {
        console.log('❌ Login failed:', error.response.data);
      } else {
        console.log('❌ Login failed:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
};

testAPI(); 