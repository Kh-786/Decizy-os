import { z } from 'zod';

/**
 * Zod validation schemas for Decizy
 * Server-side & client-side schema validation
 */

// Regex for 6-digit Indian PIN code
export const INDIAN_PIN_REGEX = /^[1-9][0-9]{5}$/;

// Regex for 10-digit Indian mobile number (with optional +91 or 0 prefix)
export const INDIAN_PHONE_REGEX = /^(?:(?:\+|0{0,2})91(\s*[-]\s*)?|[0]?)?[6789]\d{9}$/;

export const a0AssessmentSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters'),
  email: z
    .string()
    .trim()
    .email('Please provide a valid email address'),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || INDIAN_PHONE_REGEX.test(val.replace(/\s+/g, '')), {
      message: 'Please enter a valid 10-digit Indian mobile number',
    }),
  projectType: z.enum(
    ['Residential', 'Commercial', 'Hospitality', 'Retail', 'Office', 'Other'] as const
  ),
  projectCity: z
    .string()
    .trim()
    .min(2, 'Project city must be at least 2 characters')
    .max(80, 'City name is too long'),
  postalCode: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || INDIAN_PIN_REGEX.test(val.trim()), {
      message: 'Please enter a valid 6-digit Indian PIN code (e.g., 560001)',
    }),
  approximateAreaSqFt: z
    .number()
    .int('Area must be a whole number')
    .min(100, 'Approximate area should be at least 100 sq. ft.')
    .max(500000, 'Area exceeds standard maximum limit'),
  projectStage: z.enum(
    ['Planning', 'Design Underway', 'Execution', 'Renovation', 'Handover', 'Other'] as const
  ),
  budgetRangeINR: z
    .string()
    .min(1, 'Please select your estimated budget range in INR'),
  primaryChallenge: z
    .string()
    .trim()
    .min(10, 'Please describe your primary challenge in at least 10 characters')
    .max(1000, 'Description cannot exceed 1000 characters'),
  decisionNeededSoon: z.boolean().default(false),
  contactConsent: z.boolean().refine((val) => val === true, {
    message: 'Explicit consent is required to process your decision intake',
  }),
});

export type A0AssessmentFormData = z.infer<typeof a0AssessmentSchema>;

export const decisionOptionSchema = z.object({
  id: z.string(),
  title: z.string().min(2, 'Option title required'),
  description: z.string().min(5, 'Option description required'),
  estimatedCostINR: z.number().min(0, 'Estimated cost cannot be negative'),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  isRecommended: z.boolean().optional(),
});

export const decisionCreateSchema = z.object({
  projectId: z.string().uuid().or(z.string().min(1)),
  typeCode: z.string().min(1, 'Master decision code is required'),
  title: z.string().min(3, 'Title is required'),
  category: z.string().min(1, 'Category is required'),
  stage: z.enum(['Planning', 'Design Underway', 'Execution', 'Renovation', 'Handover', 'Other']),
  urgency: z.enum(['Low', 'Medium', 'High', 'Critical']),
  impact: z.enum(['Low', 'Medium', 'High', 'Severe']),
  deadlineDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid YYYY-MM-DD date required'),
  responsibleRole: z.enum(['customer', 'designer', 'project_manager', 'admin']),
  assigneeName: z.string().min(1, 'Assignee name required'),
  currentOption: z.string().min(1, 'Recommended option required'),
  optionsConsidered: z.array(decisionOptionSchema).min(1, 'At least one option must be provided'),
  rationale: z.string().optional(),
  costImpactINR: z.number().default(0),
  timeImpactDays: z.number().default(0),
  dependencies: z.array(z.string()).default([]),
});

export const decisionApprovalSchema = z.object({
  decisionId: z.string(),
  selectedOption: z.string().min(1, 'Selected option must be stated'),
  comments: z.string().optional(),
  approvedBy: z.string(),
  approvedByName: z.string(),
  approvedByRole: z.enum(['customer', 'designer', 'project_manager', 'admin']),
});

export const decisionRejectionSchema = z.object({
  decisionId: z.string(),
  reason: z.string().min(10, 'Rejection reason must be at least 10 characters'),
  rejectedBy: z.string(),
  rejectedByName: z.string(),
  rejectedByRole: z.enum(['customer', 'designer', 'project_manager', 'admin']),
});

export const decisionRevisionSchema = z.object({
  decisionId: z.string(),
  newOption: z.string().min(2, 'New option required'),
  rationale: z.string().min(10, 'Material change rationale is required (min 10 characters)'),
  costImpactINR: z.number().default(0),
  timeImpactDays: z.number().default(0),
  changedBy: z.string(),
  changedByName: z.string(),
  changedByRole: z.enum(['customer', 'designer', 'project_manager', 'admin']),
});
