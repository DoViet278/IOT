const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "IoT Device API",
      version: "1.0.0",
      description: "API điều khiển thiết bị và đọc dữ liệu sensor"
    },
    servers: [
      {
        url: "http://localhost:5000"
      }
    ]
  },
  apis: ["./src/routes/*.js"], // đọc comment swagger trong routes
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;