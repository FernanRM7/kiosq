import { ApiProperty } from "@nestjs/swagger";

export class MeResponseSchema {
  @ApiProperty({
    description: "WorkOS User ID",
    example: "user_01HXYZ",
    type: String,
  })
  id: string;

  @ApiProperty({
    description: "User email address",
    example: "user@example.com",
    type: String,
  })
  email: string;

  @ApiProperty({
    description: "First name",
    example: "Jane",
    nullable: true,
    type: String,
  })
  firstName: string | null;

  @ApiProperty({
    description: "Last name",
    example: "Doe",
    nullable: true,
    type: String,
  })
  lastName: string | null;

  @ApiProperty({
    description: "Whether the email address has been verified",
    example: true,
    type: Boolean,
  })
  emailVerified: boolean;

  @ApiProperty({
    description: "Organization ID the user belongs to",
    example: "org_01HXYZ",
    required: false,
    type: String,
  })
  organizationId: string | undefined;

  @ApiProperty({
    description: "User role within the organization",
    example: "admin",
    required: false,
    type: String,
  })
  role: string | undefined;
}
