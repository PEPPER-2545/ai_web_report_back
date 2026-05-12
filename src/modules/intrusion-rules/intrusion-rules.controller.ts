import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IntrusionRulesService } from './intrusion-rules.service';
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('intrusion-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IntrusionRulesController {
    constructor(
        private readonly intrusionRulesService: IntrusionRulesService,
        private readonly storageService: StorageService
    ) {}

    @Get()
    async findAll(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '20',
    ) {
        return this.intrusionRulesService.findAll(Number(page), Number(limit));
    }

    @Post()
    async create(@Body() body: any) {
        return this.intrusionRulesService.create(body);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() body: any) {
        return this.intrusionRulesService.update(id, body);
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        return this.intrusionRulesService.remove(id);
    }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    async uploadImage(
        @UploadedFile() file: any, 
        @Query('field') fieldName: string
    ) {
        if (!file) throw new BadRequestException('No file provided');
        if (!fieldName) throw new BadRequestException('Field name not provided');

        // Target folder based on the field name
        const allowedFolders = ['camera_view_image', 'intrusion_image_night', 'intrusion_image', 'map_plan_image', 'camera_logo', 'site_logo'];
        let folder = 'others';
        if (fieldName === 'camera_logo' || fieldName === 'site_logo') {
            folder = 'site_logo';
        } else if (allowedFolders.includes(fieldName)) {
            folder = fieldName;
        }
        
        const fileExt = file.originalname.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const url = await this.storageService.uploadMiocFile(file, fileName, folder);
        return { url };
    }
}
