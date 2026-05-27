const axios = require('axios');

class OdooService {
  constructor(odooConfig) {
    this.baseURL = odooConfig.baseURL;
    this.database = odooConfig.database;
    this.username = odooConfig.username;
    this.password = odooConfig.password;
    this.client = axios.create({
      baseURL: this.baseURL
    });
  }

  async authenticate() {
    try {
      const response = await this.client.post('/web/session/authenticate', {
        jsonrpc: '2.0',
        params: {
          db: this.database,
          login: this.username,
          password: this.password
        }
      });
      
      return response.data.result;
    } catch (error) {
      console.error('Odoo authentication failed:', error);
      throw error;
    }
  }

  async syncOrderToOdoo(orderData) {
    try {
      // Authenticate first
      const session = await this.authenticate();
      
      // Prepare Odoo order format
      const odooOrder = {
        partner_id: orderData.odooCustomerId || await this.getOrCreateCustomer(orderData.user),
        order_line: orderData.items.map(item => ({
          product_id: item.odooProductId,
          product_uom_qty: item.quantity,
          price_unit: item.price,
          name: item.name
        })),
        amount_total: orderData.totalAmount,
        amount_tax: orderData.taxAmount,
        note: orderData.customerNotes
      };

      // Create sale order in Odoo
      const response = await this.client.post('/api/sale.order', {
        jsonrpc: '2.0',
        params: odooOrder
      }, {
        headers: {
          'Cookie': `session_id=${session.session_id}`
        }
      });

      return response.data.result;
    } catch (error) {
      console.error('Odoo order sync failed:', error);
      throw error;
    }
  }

  async syncProductToOdoo(productData) {
    try {
      const session = await this.authenticate();
      
      const odooProduct = {
        name: productData.name,
        default_code: productData.sku,
        list_price: productData.price,
        standard_price: productData.cost,
        type: 'product',
        sale_ok: true,
        purchase_ok: true,
        uom_id: 1, // Units
        uom_po_id: 1,
        description: productData.description
      };

      const response = await this.client.post('/api/product.product', {
        jsonrpc: '2.0',
        params: odooProduct
      }, {
        headers: {
          'Cookie': `session_id=${session.session_id}`
        }
      });

      return response.data.result;
    } catch (error) {
      console.error('Odoo product sync failed:', error);
      throw error;
    }
  }

  async getOrCreateCustomer(userData) {
    // Check if customer exists in Odoo
    // If not, create new customer/partner
    // Return Odoo partner_id
  }
}

module.exports = OdooService;