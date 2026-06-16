import { ApiProperty } from "@nestjs/swagger";

/** Shape of the data returned by GET /auth/login */
export class AuthorizationUrlResponseSchema {
  @ApiProperty({
    description:
      "WorkOS AuthKit authorization URL. Redirect the user's browser to this URL to start authentication.",
    example:
      "https://auth.workos.com/oauth2/authorize?client_id=client_01&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback&response_type=code&provider=authkit",
  })
  authorizationUrl: string;
}
