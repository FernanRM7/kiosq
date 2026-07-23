import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";

import { Public } from "../src/decorators/public.decorator";
import { ValidationBodyDto } from "./validation-test.dto";

@Controller("validation-test")
@Public()
export class ValidationTestController {
  @Post()
  @HttpCode(HttpStatus.OK)
  validate(@Body() body: ValidationBodyDto): ValidationBodyDto {
    return body;
  }
}
