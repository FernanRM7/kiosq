import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";

import { ValidationBodyDto } from "./validation-test.dto";

@Controller("validation-test")
export class ValidationTestController {
  @Post()
  @HttpCode(HttpStatus.OK)
  validate(@Body() body: ValidationBodyDto): ValidationBodyDto {
    return body;
  }
}
