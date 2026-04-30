import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateTourDto } from './dto/create-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';
import { tourBannerMulterOptions } from './tour-banner-multer.config';
import { TourService } from './tour.service';

@Controller('tours')
export class TourController {
  constructor(private readonly tourService: TourService) {}

  @Get()
  list(
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
    @Query('q') q?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    return this.tourService.listPaginated(offset, limit, q, sortBy, sortDir);
  }

  @Post()
  @UseInterceptors(FileInterceptor('bannerImage', tourBannerMulterOptions()))
  create(
    @Body() dto: CreateTourDto,
    @UploadedFile() bannerImage?: Express.Multer.File,
  ) {
    return this.tourService.create(dto, bannerImage);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('bannerImage', tourBannerMulterOptions()))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTourDto,
    @UploadedFile() bannerImage?: Express.Multer.File,
  ) {
    return this.tourService.update(id, dto, bannerImage);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tourService.remove(id);
  }
}
