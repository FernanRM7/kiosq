import { ApiProperty } from "@nestjs/swagger";

export class MeResponseSchema {
  @ApiProperty({
    description: "WorkOS User ID",
    example: "user_01HXYZ",
  })
  id: string;

  @ApiProperty({
    description: "User email address",
    example: "user@example.com",
  })
  email: string;

  @ApiProperty({
    description: "First name",
    example: "Jane",
    nullable: true,
  })
  firstName: string | null;

  @ApiProperty({
    description: "Last name",
    example: "Doe",
    nullable: true,
  })
  lastName: string | null;

  @ApiProperty({
    description: "Whether the email address has been verified",
    example: true,
  })
  emailVerified: boolean;

  @ApiProperty({
    description: "Organization ID the user belongs to",
    example: "org_01HXYZ",
    required: false,
  })
  organizationId: string | undefined;

  @ApiProperty({
    description: "User role within the organization",
    example: "admin",
    required: false,
  })
  role: string | undefined;
}
