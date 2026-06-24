const crypto = require('crypto');
const axios = require('axios');

class FixedFloatAPI {
  constructor(apiKey, apiSecret, refCode) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.refCode = refCode;
    this.baseURL = 'https://ff.io/api/v2';
  }

  generateSignature(data) {
    const jsonData = JSON.stringify(data);
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(jsonData)
      .digest('hex');
  }

  async request(method, data = {}) {
    const signature = this.generateSignature(data);
    
    try {
      const response = await axios.post(`${this.baseURL}/${method}`, data, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json; charset=UTF-8',
          'X-API-KEY': this.apiKey,
          'X-API-SIGN': signature
        }
      });

      if (response.data.code !== 0) {
        throw new Error(response.data.msg || 'API Error');
      }

      return response.data.data;
    } catch (error) {
      if (error.response?.data) {
        throw new Error(error.response.data.msg || 'API Request Failed');
      }
      throw error;
    }
  }

  async getCurrencies() {
    return this.request('ccies', {});
  }

  async getPrice(params) {
    const { fromCcy, toCcy, amount, direction, type = 'float' } = params;
    
    return this.request('price', {
      fromCcy,
      toCcy,
      amount: parseFloat(amount),
      direction,
      type,
      refcode: this.refCode
    });
  }

  async createOrder(params) {
    const { fromCcy, toCcy, amount, direction, toAddress, type = 'float', tag } = params;
    
    const orderData = {
      fromCcy,
      toCcy,
      amount: parseFloat(amount),
      direction,
      toAddress,
      type,
      refcode: this.refCode
    };

    if (tag) {
      orderData.tag = tag;
    }

    return this.request('create', orderData);
  }

  async getOrder(id, token) {
    return this.request('order', { id, token });
  }

  async setEmergency(id, token, choice, address, tag) {
    const data = { id, token, choice };
    
    if (address) data.address = address;
    if (tag) data.tag = tag;

    return this.request('emergency', data);
  }

  async setEmail(id, token, email) {
    return this.request('setEmail', { id, token, email });
  }
}

module.exports = FixedFloatAPI;
