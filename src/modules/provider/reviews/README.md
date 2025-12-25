# Provider Reviews API

This module handles review functionality for providers to review customers and manage their received reviews.

## Endpoints

### Reviews Management

#### POST `/api/provider/reviews`
Create a new review for a customer.

**Request Body:**
```json
{
  "projectId": "uuid",
  "recipientId": "uuid", // Customer ID
  "company": "Company Name",
  "role": "Project Manager",
  "content": "Review content",
  "rating": 5,
  "communicationRating": 5,
  "clarityRating": 5,
  "paymentRating": 5,
  "professionalismRating": 5
}
```

#### GET `/api/provider/reviews`
Get reviews for the authenticated provider.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `rating` (optional): Filter by rating (1-5)
- `search` (optional): Search in content, project title, or names
- `sortBy` (optional): Sort by "newest", "oldest", "highest", "lowest" (default: "newest")
- `status` (optional): Filter by "given" or "received"

#### GET `/api/provider/reviews/:id`
Get a specific review by ID.

#### PUT `/api/provider/reviews/:id`
Update a review (only if you're the reviewer).

**Request Body:**
```json
{
  "content": "Updated review content",
  "rating": 4,
  "communicationRating": 4,
  "clarityRating": 4,
  "paymentRating": 4,
  "professionalismRating": 4
}
```

#### DELETE `/api/provider/reviews/:id`
Delete a review (only if you're the reviewer).

### Review Interactions

#### POST `/api/provider/reviews/:id/reply`
Create a reply to a review (only if you're the recipient).

**Request Body:**
```json
{
  "content": "Reply content"
}
```

#### PUT `/api/provider/reviews/reply/:replyId`
Update a review reply.

**Request Body:**
```json
{
  "content": "Updated reply content"
}
```

### Statistics and Projects

#### GET `/api/provider/reviews/statistics`
Get review statistics for the authenticated provider.

**Response:**
```json
{
  "success": true,
  "statistics": {
    "totalReviews": 87,
    "averageRating": 4.9,
    "givenReviews": 45,
    "pendingReviews": 3,
    "ratingDistribution": [...]
  }
}
```

#### GET `/api/provider/reviews/projects/completed`
Get completed projects that need reviews.

## Authentication

All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Error Responses

All endpoints return consistent error responses:
```json
{
  "success": false,
  "message": "Error description"
}
```

## Success Responses

All endpoints return consistent success responses:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {...} // Response data
}
```

## Category Ratings

Provider reviews use different category ratings compared to company reviews:

- **Communication**: How responsive and clear was the client?
- **Clarity**: Were project requirements well-defined?
- **Payment**: Was payment timely and as agreed?
- **Professionalism**: How professional was the client?
