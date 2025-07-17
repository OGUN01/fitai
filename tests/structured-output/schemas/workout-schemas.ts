/**
 * Modern Workout Schemas for Google Structured Output
 * 
 * These schemas define the exact structure that Google Gemini will return
 * using native structured output - NO JSON parsing required!
 */

import { z } from 'zod';

// Exercise Schema - Individual exercise definition
export const ExerciseSchema = z.object({
  name: z.string().min(2, "Exercise name required"),
  sets: z.number().int().min(1).max(10),
  reps: z.union([
    z.number().int().min(1).max(100),
    z.string().regex(/^\d+(-\d+)?( seconds| sec)?$/, "Valid reps format required")
  ]),
  restSeconds: z.number().int().min(15).max(300),
  notes: z.string().optional(),
  targetMuscles: z.array(z.string()).min(1),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  equipment: z.string().optional()
});

// Workout Day Schema - Single day's workout
export const WorkoutDaySchema = z.object({
  day: z.string().min(2),
  focus: z.string().min(2),
  duration: z.number().int().min(15).max(120), // minutes
  exercises: z.array(ExerciseSchema).min(3).max(12),
  warmUp: z.array(z.string()).min(2).max(5),
  coolDown: z.array(z.string()).min(2).max(5)
});

// Progression Plan Schema
export const ProgressionPlanSchema = z.object({
  week2: z.string().min(10),
  week3: z.string().min(10),
  week4: z.string().min(10),
  longTerm: z.string().min(10)
});

// Complete Workout Plan Schema
export const WorkoutPlanSchema = z.object({
  planName: z.string().min(5),
  description: z.string().min(20),
  weeklySchedule: z.array(WorkoutDaySchema).min(1).max(7),
  totalWeeklyDuration: z.number().int().min(60).max(600), // minutes
  difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  equipmentRequired: z.array(z.string()),
  progressionPlan: ProgressionPlanSchema,
  safetyNotes: z.array(z.string()).min(2),
  nutritionTips: z.array(z.string()).min(2)
});

// TypeScript types derived from Zod schemas
export type Exercise = z.infer<typeof ExerciseSchema>;
export type WorkoutDay = z.infer<typeof WorkoutDaySchema>;
export type ProgressionPlan = z.infer<typeof ProgressionPlanSchema>;
export type WorkoutPlan = z.infer<typeof WorkoutPlanSchema>;

// Google Gemini Schema Format (converted from Zod)
import { SchemaType } from "@google/generative-ai";

export const GoogleWorkoutPlanSchema = {
  type: SchemaType.OBJECT,
  properties: {
    planName: { type: SchemaType.STRING, description: "Name of the workout plan" },
    description: { type: SchemaType.STRING, description: "Brief description of the plan" },
    weeklySchedule: {
      type: SchemaType.ARRAY,
      description: "Weekly workout schedule",
      items: {
        type: "object",
        properties: {
          day: { type: "string", description: "Day name (e.g., Monday)" },
          focus: { type: "string", description: "Focus area (e.g., Upper Body)" },
          duration: { type: "number", description: "Workout duration in minutes" },
          exercises: {
            type: "array",
            description: "List of exercises",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Exercise name" },
                sets: { type: "number", description: "Number of sets" },
                reps: { 
                  type: "string", 
                  description: "Reps (number or range like '8-12' or '30 seconds')" 
                },
                restSeconds: { type: "number", description: "Rest time in seconds" },
                notes: { type: "string", description: "Additional notes" },
                targetMuscles: {
                  type: "array",
                  items: { type: "string" },
                  description: "Target muscle groups"
                },
                difficulty: { 
                  type: "string", 
                  enum: ["beginner", "intermediate", "advanced"],
                  description: "Exercise difficulty level"
                },
                equipment: { type: "string", description: "Required equipment" }
              },
              required: ["name", "sets", "reps", "restSeconds", "targetMuscles", "difficulty"]
            }
          },
          warmUp: {
            type: "array",
            items: { type: "string" },
            description: "Warm-up activities"
          },
          coolDown: {
            type: "array", 
            items: { type: "string" },
            description: "Cool-down activities"
          }
        },
        required: ["day", "focus", "duration", "exercises", "warmUp", "coolDown"]
      }
    },
    totalWeeklyDuration: { type: "number", description: "Total weekly workout time in minutes" },
    difficultyLevel: { 
      type: "string", 
      enum: ["beginner", "intermediate", "advanced"],
      description: "Overall plan difficulty"
    },
    equipmentRequired: {
      type: "array",
      items: { type: "string" },
      description: "Equipment needed for the plan"
    },
    progressionPlan: {
      type: "object",
      properties: {
        week2: { type: "string", description: "Week 2 progression strategy" },
        week3: { type: "string", description: "Week 3 progression strategy" },
        week4: { type: "string", description: "Week 4 progression strategy" },
        longTerm: { type: "string", description: "Long-term progression plan" }
      },
      required: ["week2", "week3", "week4", "longTerm"]
    },
    safetyNotes: {
      type: "array",
      items: { type: "string" },
      description: "Important safety considerations"
    },
    nutritionTips: {
      type: "array",
      items: { type: "string" },
      description: "Nutrition recommendations for this plan"
    }
  },
  required: [
    "planName", "description", "weeklySchedule", "totalWeeklyDuration", 
    "difficultyLevel", "equipmentRequired", "progressionPlan", "safetyNotes", "nutritionTips"
  ]
};
