/// <reference path="./swagger-jsdoc.d.ts" />

import swaggerJSDoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Hotcake API",
      version: "1.0.0",
      description: "API documentation for Hotcake (Verbose) backend",
    },
    servers: [{ url: "http://localhost:4000" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["src/routes/**/*.ts", "src/controllers/**/*.ts"],
});
