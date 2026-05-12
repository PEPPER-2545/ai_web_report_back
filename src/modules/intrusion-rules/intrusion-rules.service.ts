import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { StorageService } from '../../storage/storage.service';

@Injectable()
export class IntrusionRulesService {
    constructor(
        @InjectDataSource('mioc_conn')
        private miocDataSource: DataSource,
        private storageService: StorageService,
    ) { }

    async findAll(page: number, limit: number): Promise<any> {
        const offset = (page - 1) * limit;

        const countResult = await this.miocDataSource.query(`
            SELECT COUNT(*) as total FROM intrusion_rule_infos WHERE deleted_at IS NULL
        `);
        const total = parseInt(countResult[0].total, 10);

        const data = await this.miocDataSource.query(
            `SELECT * FROM intrusion_rule_infos WHERE deleted_at IS NULL ORDER BY 1 DESC LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        return {
            data,
            total,
            page,
            lastPage: Math.ceil(total / limit),
            limit
        };
    }

    async create(data: any): Promise<any> {
        // Exclude specific fields if they shouldn't be inserted
        const { _id, ...insertData } = data;

        const columnNames = Object.keys(insertData);
        const placeholdersList = columnNames.map((_, i) => `$${i + 1}`);
        const values = Object.values(insertData);

        // Explicitly set created_at
        columnNames.push('created_at');
        placeholdersList.push('NOW()');

        const columns = columnNames.join(', ');
        const placeholders = placeholdersList.join(', ');

        await this.miocDataSource.query(
            `INSERT INTO intrusion_rule_infos (${columns}) VALUES (${placeholders})`,
            values
        );
        return { message: 'Record created successfully' };
    }

    async update(id: string, data: any): Promise<any> {
        // Remove primary keys or frontend-specific metadata from update data
        const { id: _, _id, ...updateData } = data;

        if (Object.keys(updateData).length === 0) {
            return { message: 'No fields to update' };
        }

        // --- Handle orphaned images cleanup ---
        try {
            const existingRows = await this.miocDataSource.query(`SELECT * FROM intrusion_rule_infos WHERE id = $1`, [id]);
            if (existingRows.length > 0) {
                const existing = existingRows[0];
                for (const key of Object.keys(updateData)) {
                    // Check if field was an image URL and has changed
                    const lowerKey = key.toLowerCase();
                    const isImageField = lowerKey.includes('image') || lowerKey.includes('logo');
                    const oldVal = existing[key];
                    const newVal = updateData[key];
                    if (isImageField && oldVal && typeof oldVal === 'string' && oldVal !== newVal) {
                        if (oldVal.includes('mioc-report')) {
                            // Delete from Minio
                            await this.storageService.deleteMiocFile(oldVal);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Error cleaning up images on update', err);
        }

        const updates = Object.keys(updateData)
            .map((k, i) => `${k} = $${i + 2}`)
            .join(', ');
        const values = [id, ...Object.values(updateData)];

        await this.miocDataSource.query(
            `UPDATE intrusion_rule_infos SET ${updates} WHERE id = $1`,
            values
        );
        return { message: 'Record updated successfully' };
    }

    async remove(id: string): Promise<any> {
        // --- Find existing to delete attached images ---
        try {
            const existingRows = await this.miocDataSource.query(`SELECT * FROM intrusion_rule_infos WHERE id = $1`, [id]);
            if (existingRows.length > 0) {
                const existing = existingRows[0];
                for (const key of Object.keys(existing)) {
                    const lowerKey = key.toLowerCase();
                    const isImageField = lowerKey.includes('image') || lowerKey.includes('logo');
                    const val = existing[key];
                    if (isImageField && val && typeof val === 'string' && val.includes('mioc-report')) {
                        await this.storageService.deleteMiocFile(val);
                    }
                }
            } else {
                throw new NotFoundException('Record not found');
            }
        } catch (err) {
            console.error('Error fetching or deleting orphaned images on remove', err);
        }

        // --- Soft Delete Database Record ---
        await this.miocDataSource.query(`UPDATE intrusion_rule_infos SET deleted_at = NOW() WHERE id = $1`, [id]);
        return { message: 'Record soft-deleted successfully' };
    }
}
