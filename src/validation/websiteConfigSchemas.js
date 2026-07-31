import { z } from "zod";

export const faqSchema = z.object({
  question: z.string().min(5, "Question must be at least 5 characters long"),
  answer: z.string().min(10, "Answer must be at least 10 characters long"),
  category: z.enum(["general", "payment", "booking", "account"], {
    errorMap: () => ({ message: "Please select a valid category" }),
  }),
});

export const testimonialSchema = z.object({
  user: z.string().min(2, "User name must be at least 2 characters"),
  role: z.string().min(2, "Role description must be at least 2 characters"),
  rating: z.number().min(1).max(5),
  text: z.string().min(10, "Feedback text must be at least 10 characters"),
  image: z.string().url("Please enter a valid photo URL").or(z.literal("")),
  displayOrder: z.number().int().default(0),
});

export const getZodErrorMessage = (error) =>
  error?.errors?.[0]?.message || "Please check the highlighted fields.";
