// src/modules/provider/milestones/dto.js

export class UpsertMilestonesDto {
  constructor(data) {
    this.milestones = data.milestones || []
  }

  validate() {
    const errors = []

    // Validate milestones array
    if (!Array.isArray(this.milestones)) {
      errors.push("Milestones must be an array")
      return errors
    }

    if (this.milestones.length === 0) {
      errors.push("At least one milestone is required")
      return errors
    }

    if (this.milestones.length > 20) {
      errors.push("Maximum 20 milestones allowed")
      return errors
    }

    // Validate each milestone
    const sequences = []
    let totalAmount = 0

    this.milestones.forEach((milestone, index) => {
      const prefix = `Milestone ${index + 1}`

      // Required fields
      if (!milestone.title || typeof milestone.title !== 'string' || milestone.title.trim() === '') {
        errors.push(`${prefix}: Title is required`)
      }

      if (typeof milestone.amount !== 'number' || milestone.amount <= 0) {
        errors.push(`${prefix}: Amount must be a positive number`)
      } else {
        totalAmount += milestone.amount
      }

      if (!milestone.dueDate || typeof milestone.dueDate !== 'string') {
        errors.push(`${prefix}: Due date is required`)
      } else {
        // Validate ISO date
        const date = new Date(milestone.dueDate)
        if (isNaN(date.getTime())) {
          errors.push(`${prefix}: Due date must be a valid ISO date`)
        } else {
          // Validate that due date is not in the past
          const today = new Date()
          today.setHours(0, 0, 0, 0) // Set to start of day for comparison
          const dueDateOnly = new Date(date)
          dueDateOnly.setHours(0, 0, 0, 0) // Set to start of day for comparison
          
          if (dueDateOnly < today) {
            errors.push(`${prefix}: Due date cannot be in the past. Please select today or a future date.`)
          }
        }
      }

      // Sequence validation
      if (typeof milestone.sequence !== 'number' || milestone.sequence < 1) {
        errors.push(`${prefix}: Sequence must be a positive number`)
      } else {
        if (sequences.includes(milestone.sequence)) {
          errors.push(`${prefix}: Sequence numbers must be unique`)
        }
        sequences.push(milestone.sequence)
      }

      // Optional description
      if (milestone.description && typeof milestone.description !== 'string') {
        errors.push(`${prefix}: Description must be a string`)
      }
    })

    // Validate sequence ordering
    const sortedSequences = [...sequences].sort((a, b) => a - b)
    for (let i = 0; i < sortedSequences.length; i++) {
      if (sortedSequences[i] !== i + 1) {
        errors.push("Sequence numbers must be consecutive starting from 1")
        break
      }
    }

    return errors
  }

  // Normalize sequences to be consecutive starting from 1
  normalizeSequences() {
    this.milestones.sort((a, b) => a.sequence - b.sequence)
    this.milestones.forEach((milestone, index) => {
      milestone.sequence = index + 1
    })
  }

  // Sanitize milestone data
  sanitize() {
    this.milestones = this.milestones.map(milestone => ({
      sequence: milestone.sequence,
      title: milestone.title.trim(),
      description: milestone.description ? milestone.description.trim() : null,
      amount: Number(milestone.amount),
      dueDate: milestone.dueDate
    }))
  }
}
