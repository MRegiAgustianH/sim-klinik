import {
  Body,
  Controller,
  Delete,
  Get,
  Module,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePermission } from '../auth/permissions.guard';
import { AuthUser, displayName } from '../auth/jwt.strategy';
import { TemplateBody, TemplatesService } from './templates.service';

type Req = { user: AuthUser };

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/template')
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  // Template nonaktif hanya ditampilkan bagi pengelola template.
  @Get()
  list(@Request() req: Req, @Query('semua') all?: string) {
    const canManage = req.user.isSuperadmin || req.user.permissions.includes('template.kelola');
    return { data: this.service.list(all === '1' && canManage) };
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @RequirePermission('template.kelola')
  @Post()
  create(@Request() req: Req, @Body() body: TemplateBody) {
    return this.service.create(body, displayName(req.user));
  }

  @RequirePermission('template.kelola')
  @Put(':id')
  update(@Request() req: Req, @Param('id', ParseIntPipe) id: number, @Body() body: TemplateBody) {
    return this.service.update(id, body, displayName(req.user));
  }

  @RequirePermission('template.kelola')
  @Put(':id/aktif')
  setActive(@Request() req: Req, @Param('id', ParseIntPipe) id: number, @Body() body: { isActive?: boolean }) {
    return this.service.setActive(id, body?.isActive !== false, displayName(req.user));
  }

  @RequirePermission('template.kelola')
  @Post(':id/duplikat')
  duplicate(@Request() req: Req, @Param('id', ParseIntPipe) id: number) {
    return this.service.duplicate(id, displayName(req.user));
  }

  @RequirePermission('template.kelola')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @RequirePermission('template.kelola')
  @Get(':id/versi')
  versions(@Param('id', ParseIntPipe) id: number) {
    return { data: this.service.versions(id) };
  }

  @RequirePermission('template.kelola')
  @Post(':id/versi/:version/pulihkan')
  restore(@Request() req: Req, @Param('id', ParseIntPipe) id: number, @Param('version', ParseIntPipe) version: number) {
    return this.service.restore(id, version, displayName(req.user));
  }
}

@Module({
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
