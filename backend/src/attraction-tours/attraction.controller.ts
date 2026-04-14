import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { AttractionService } from './attraction.service';
import { CreateAttractionDto } from './dto/create-attraction.dto';
import { UpdateAttractionDto } from './dto/update-attraction.dto';

@Controller('attractions')
export class AttractionController {
  constructor(private readonly attractionService: AttractionService) {}

  @Get()
  list() {
    return this.attractionService.list();
  }

  @Post()
  create(@Body() dto: CreateAttractionDto) {
    return this.attractionService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAttractionDto,
  ) {
    return this.attractionService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.attractionService.remove(id);
  }
}
