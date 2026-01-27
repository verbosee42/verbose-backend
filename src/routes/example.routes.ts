/**
 * Example usage of types and middlewares
 * This file demonstrates how to use the error handlers and types in your routes
 */

import { Router, Request, Response } from "express";
import { asyncHandler } from "../middlewares";
import {
  ApiResponse,
  NotFoundError,
  ValidationError,
  AuthenticationError,
} from "../types";

const exampleRouter = Router();

// Example 1: Using asyncHandler to automatically catch errors
exampleRouter.get(
  "/users/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    // Simulate database query
    // const user = await prisma.user.findUnique({ where: { id } });

    // If not found, throw error - it will be caught by asyncHandler
    // if (!user) {
    //   throw new NotFoundError("User not found");
    // }

    const response: ApiResponse = {
      success: true,
      message: "User retrieved successfully",
      data: { id, name: "John Doe", email: "john@example.com" },
    };

    res.json(response);
  })
);

// Example 2: Throwing validation errors
exampleRouter.post(
  "/users",
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ValidationError("Email and password are required");
    }

    // Simulate user creation
    // const user = await prisma.user.create({ data: { email, password } });

    const response: ApiResponse = {
      success: true,
      message: "User created successfully",
      data: { id: "123", email },
    };

    res.status(201).json(response);
  })
);

// Example 3: Protected route with authentication
exampleRouter.get(
  "/profile",
  asyncHandler(async (req: Request, res: Response) => {
    // Check if user is authenticated (from auth middleware)
    if (!req.auth) {
      throw new AuthenticationError("Please log in to access this resource");
    }

    const response: ApiResponse = {
      success: true,
      data: req.auth,
    };

    res.json(response);
  })
);

// Example 4: Manual error handling (without asyncHandler)
exampleRouter.delete("/users/:id", async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;

    // Simulate deletion
    // await prisma.user.delete({ where: { id } });

    const response: ApiResponse = {
      success: true,
      message: "User deleted successfully",
    };

    res.json(response);
  } catch (error) {
    next(error); // Pass error to error handler
  }
});

export default exampleRouter;
