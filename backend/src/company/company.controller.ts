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
} from '@nestjs/common';
import { CompanyService } from './company.service';
import {
  CreateCompanyContactDto,
  UpdateCompanyContactDto,
} from './dto/create-company-contact.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateVenueTicketingDto } from './dto/update-venue-ticketing.dto';
import { UpdateVenueProfileDto } from './dto/update-venue-profile.dto';

/** Static path routes must be registered before `:id` to avoid shadowing. */
@Controller('companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  findAll(
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
    @Query('q') q?: string,
    @Query('companyType') companyType?: string,
  ) {
    return this.companyService.findAllPaginated(offset, limit, q, companyType);
  }

  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companyService.create(dto);
  }

  @Get(':id/contacts')
  listContacts(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.listContacts(id);
  }

  @Post(':id/contacts')
  addContact(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCompanyContactDto,
  ) {
    return this.companyService.addContact(id, dto);
  }

  @Get(':id/engagements')
  listEngagements(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.listEngagements(id);
  }

  @Get(':id/venue-ticketing')
  getVenueTicketing(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.getVenueTicketing(id);
  }

  @Patch(':id/venue-ticketing')
  updateVenueTicketing(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVenueTicketingDto,
  ) {
    return this.companyService.updateVenueTicketing(id, dto);
  }

  @Get(':id/venue-profile')
  getVenueProfile(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.getVenueProfile(id);
  }

  @Post(':id/venue-profile/provision')
  provisionVenueProfile(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.provisionVenueProfile(id);
  }

  @Patch(':id/venue-profile')
  updateVenueProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVenueProfileDto,
  ) {
    return this.companyService.updateVenueProfile(id, dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCompanyDto) {
    return this.companyService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.remove(id);
  }
}

@Controller('contact-assignments')
export class ContactAssignmentsController {
  constructor(private readonly companyService: CompanyService) {}

  @Patch(':assignmentId')
  updateContact(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Body() dto: UpdateCompanyContactDto,
  ) {
    return this.companyService.updateContact(assignmentId, dto);
  }

  @Delete(':assignmentId')
  removeContact(@Param('assignmentId', ParseIntPipe) assignmentId: number) {
    return this.companyService.removeContact(assignmentId);
  }
}