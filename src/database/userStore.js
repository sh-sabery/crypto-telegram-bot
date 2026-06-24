class UserStore {
  constructor() {
    this.users = new Map();
    this.orders = new Map();
  }

  saveUser(userId, userData) {
    const timestamp = Date.now();
    
    this.users.set(userId, {
      user_id: userId,
      username: userData.username || null,
      language: userData.language_code || 'en',
      first_seen: this.users.has(userId) ? this.users.get(userId).first_seen : timestamp,
      last_seen: timestamp,
      total_orders: this.users.has(userId) ? this.users.get(userId).total_orders : 0
    });

    return this.users.get(userId);
  }

  getUser(userId) {
    return this.users.get(userId);
  }

  incrementOrderCount(userId) {
    const user = this.getUser(userId);
    if (user) {
      user.total_orders += 1;
      this.users.set(userId, user);
    }
  }

  saveOrder(userId, orderData) {
    if (!this.orders.has(userId)) {
      this.orders.set(userId, []);
    }

    const userOrders = this.orders.get(userId);
    userOrders.push({
      ...orderData,
      created_at: Date.now()
    });

    // حداکثر 50 سفارش اخیر رو نگه می‌داریم
    if (userOrders.length > 50) {
      userOrders.shift();
    }

    return orderData;
  }

  getUserOrders(userId) {
    return this.orders.get(userId) || [];
  }

  getOrderById(userId, orderId) {
    const userOrders = this.getUserOrders(userId);
    return userOrders.find(order => order.id === orderId);
  }

  // برای compliance با درخواست FixedFloat
  exportUserData(userId) {
    return {
      user: this.getUser(userId),
      orders: this.getUserOrders(userId),
      exported_at: new Date().toISOString()
    };
  }

  getAllUsers() {
    return Array.from(this.users.values());
  }
}

module.exports = new UserStore();
