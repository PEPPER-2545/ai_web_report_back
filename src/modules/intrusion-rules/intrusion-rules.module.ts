import { Module } from '@nestjs/common';
import { IntrusionRulesService } from './intrusion-rules.service';
import { IntrusionRulesController } from './intrusion-rules.controller';

@Module({
    controllers: [IntrusionRulesController],
    providers: [IntrusionRulesService],
    exports: [IntrusionRulesService],
})
export class IntrusionRulesModule {}
