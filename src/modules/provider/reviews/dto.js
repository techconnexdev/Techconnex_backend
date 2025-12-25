// src/modules/provider/reviews/dto.js

export class CreateReviewDto {
  constructor(data) {
    this.projectId = data.projectId;
    this.recipientId = data.recipientId; // Customer ID
    this.reviewerId = data.reviewerId; // Provider ID
    this.company = data.company;
    this.role = data.role;
    this.content = data.content;
    this.rating = data.rating;
    this.communicationRating = data.communicationRating;
    this.clarityRating = data.clarityRating;
    this.paymentRating = data.paymentRating;
    this.professionalismRating = data.professionalismRating;
  }

  validate() {
    if (!this.projectId) throw new Error("Project ID is required");
    if (!this.recipientId) throw new Error("Recipient ID is required");
    if (!this.reviewerId) throw new Error("Reviewer ID is required");
    if (!this.content || this.content.trim() === "") throw new Error("Review content is required");
    if (!this.rating || this.rating < 1 || this.rating > 5) throw new Error("Rating must be between 1 and 5");
    
    // Validate category ratings
    if (this.communicationRating && (this.communicationRating < 1 || this.communicationRating > 5)) {
      throw new Error("Communication rating must be between 1 and 5");
    }
    if (this.clarityRating && (this.clarityRating < 1 || this.clarityRating > 5)) {
      throw new Error("Clarity rating must be between 1 and 5");
    }
    if (this.paymentRating && (this.paymentRating < 1 || this.paymentRating > 5)) {
      throw new Error("Payment rating must be between 1 and 5");
    }
    if (this.professionalismRating && (this.professionalismRating < 1 || this.professionalismRating > 5)) {
      throw new Error("Professionalism rating must be between 1 and 5");
    }
  }
}

export class GetReviewsDto {
  constructor(data) {
    this.providerId = data.providerId;
    this.page = parseInt(data.page) || 1;
    this.limit = parseInt(data.limit) || 10;
    this.rating = data.rating ? parseInt(data.rating) : undefined;
    this.search = data.search;
    this.sortBy = data.sortBy || "newest";
    this.status = data.status; // "given" or "received"
  }

  validate() {
    if (!this.providerId) {
      throw new Error("Provider ID is required");
    }
    
    // Validate pagination
    if (this.page < 1) {
      throw new Error("Page must be greater than 0");
    }
    if (this.limit < 1 || this.limit > 100) {
      throw new Error("Limit must be between 1 and 100");
    }
    
    // Validate rating filter
    if (this.rating && (this.rating < 1 || this.rating > 5)) {
      throw new Error("Rating filter must be between 1 and 5");
    }
    
    // Validate sort options
    const validSortOptions = ["newest", "oldest", "highest", "lowest"];
    if (!validSortOptions.includes(this.sortBy)) {
      throw new Error("Invalid sort option");
    }
    
    // Validate status
    if (this.status && !["given", "received"].includes(this.status)) {
      throw new Error("Status must be 'given' or 'received'");
    }
  }
}

export class UpdateReviewDto {
  constructor(data) {
    this.reviewId = data.reviewId;
    this.providerId = data.providerId;
    this.content = data.content;
    this.rating = data.rating;
    this.communicationRating = data.communicationRating;
    this.clarityRating = data.clarityRating;
    this.paymentRating = data.paymentRating;
    this.professionalismRating = data.professionalismRating;
  }

  validate() {
    if (!this.reviewId) throw new Error("Review ID is required");
    if (!this.providerId) throw new Error("Provider ID is required");
    
    if (this.content !== undefined && (!this.content || this.content.trim() === "")) {
      throw new Error("Review content cannot be empty");
    }
    
    if (this.rating !== undefined && (this.rating < 1 || this.rating > 5)) {
      throw new Error("Rating must be between 1 and 5");
    }
    
    // Validate category ratings
    if (this.communicationRating !== undefined && (this.communicationRating < 1 || this.communicationRating > 5)) {
      throw new Error("Communication rating must be between 1 and 5");
    }
    if (this.clarityRating !== undefined && (this.clarityRating < 1 || this.clarityRating > 5)) {
      throw new Error("Clarity rating must be between 1 and 5");
    }
    if (this.paymentRating !== undefined && (this.paymentRating < 1 || this.paymentRating > 5)) {
      throw new Error("Payment rating must be between 1 and 5");
    }
    if (this.professionalismRating !== undefined && (this.professionalismRating < 1 || this.professionalismRating > 5)) {
      throw new Error("Professionalism rating must be between 1 and 5");
    }
  }
}

export class CreateReviewReplyDto {
  constructor(data) {
    this.reviewId = data.reviewId;
    this.userId = data.userId;
    this.content = data.content;
  }

  validate() {
    if (!this.reviewId) throw new Error("Review ID is required");
    if (!this.userId) throw new Error("User ID is required");
    if (!this.content || this.content.trim() === "") throw new Error("Reply content is required");
  }
}
