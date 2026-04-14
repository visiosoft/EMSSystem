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
import { CreateTourDto } from './dto/create-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';
import { TourService } from './tour.service';

@Controller('tours')
export class TourController {
  constructor(private readonly tourService: TourService) {}

  @Get()
  list() {
    return this.tourService.list();
  }

  @Post()
  create(@Body() dto: CreateTourDto) {
    return this.tourService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTourDto) {
    return this.tourService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tourService.remove(id);
  }
}
