import { z } from "zod";

// ─── WorkOS Webhook Event Schemas ─────────────────────────────────────────────
// These schemas validate only the fields we consume. WorkOS may send additional
// fields — we ignore them intentionally (open object shapes).

export const WorkosOrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  // WorkOS sends object — we only care about id + name for now
});

export const WorkosUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().nullable().optional(),
  id: z.string(),
  lastName: z.string().nullable().optional(),
});

// ─── Event envelope ───────────────────────────────────────────────────────────

export const OrganizationCreatedEventSchema = z.object({
  data: WorkosOrganizationSchema,
  event: z.literal("organization.created"),
  id: z.string(),
});

export const OrganizationUpdatedEventSchema = z.object({
  data: WorkosOrganizationSchema,
  event: z.literal("organization.updated"),
  id: z.string(),
});

export const UserCreatedEventSchema = z.object({
  data: WorkosUserSchema,
  event: z.literal("user.created"),
  id: z.string(),
});

export const UserUpdatedEventSchema = z.object({
  data: WorkosUserSchema,
  event: z.literal("user.updated"),
  id: z.string(),
});

/** Data payload for organization_membership.created */
export const WorkosMembershipSchema = z.object({
  /** WorkOS Membership ID */
  id: z.string(),
  /** WorkOS Organization ID the user joined */
  organizationId: z.string(),
  /** WorkOS role for this membership (optional — depends on org configuration) */
  role: z.object({ slug: z.string() }).optional().nullable(),
  /** WorkOS User ID of the member */
  userId: z.string(),
});

export const OrganizationMembershipCreatedEventSchema = z.object({
  data: WorkosMembershipSchema,
  event: z.literal("organization_membership.created"),
  id: z.string(),
});

// ─── Discriminated union ──────────────────────────────────────────────────────

export const WorkosEventSchema = z.discriminatedUnion("event", [
  OrganizationCreatedEventSchema,
  OrganizationUpdatedEventSchema,
  UserCreatedEventSchema,
  UserUpdatedEventSchema,
  OrganizationMembershipCreatedEventSchema,
]);

export type WorkosEvent = z.infer<typeof WorkosEventSchema>;
export type WorkosOrganizationEvent = z.infer<
  typeof OrganizationCreatedEventSchema
>;
export type WorkosUserEvent = z.infer<typeof UserCreatedEventSchema>;
export type WorkosMembershipEvent = z.infer<
  typeof OrganizationMembershipCreatedEventSchema
>;
