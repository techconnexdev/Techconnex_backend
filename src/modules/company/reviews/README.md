# Company Reviews API

This module handles review functionality for companies (customers) to review providers.

## Endpoints

### Reviews Management

#### POST `/api/company/reviews`
Create a new review for a provider.

**Request Body:**
```json
{
  "projectId": "uuid",
  "recipientId": "uuid", // Provider ID
  "company": "Company Name",
  "role": "Project Manager",
  "content": "Review content",
  "rating": 5,
  "communicationRating": 5,
  "qualityRating": 5,
  "timelinessRating": 5,
  "professionalismRating": 5
}
```

#### GET `/api/company/reviews`
Get reviews for the authenticated customer.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `rating` (optional): Filter by rating (1-5)
- `search` (optional): Search in content, project title, or names
- `sortBy` (optional): Sort by "newest", "oldest", "highest", "lowest" (default: "newest")
- `status` (optional): Filter by "given" or "received"

#### GET `/api/company/reviews/:id`
Get a specific review by ID.

#### PUT `/api/company/reviews/:id`
Update a review (only if you're the reviewer).

**Request Body:**
```json
{
  "content": "Updated review content",
  "rating": 4,
  "communicationRating": 4,
  "qualityRating": 4,
  "timelinessRating": 4,
  "professionalismRating": 4
}
```

#### DELETE `/api/company/reviews/:id`
Delete a review (only if you're the reviewer).

### Review Interactions

#### POST `/api/company/reviews/:id/reply`
Create a reply to a review (only if you're the recipient).

**Request Body:**
```json
{
  "content": "Reply content"
}
```

#### PUT `/api/company/reviews/reply/:replyId`
Update a review reply.

**Request Body:**
```json
{
  "content": "Updated reply content"
}
```

### Statistics and Projects

#### GET `/api/company/reviews/statistics`
Get review statistics for the authenticated customer.

**Response:**
```json
{
  "success": true,
  "statistics": {
    "totalReviews": 15,
    "averageRating": 4.8,
    "pendingReviews": 3,
    "ratingDistribution": [...]
  }
}
```

#### GET `/api/company/reviews/projects/completed`
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
