import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from './contact.entity';
import { ContactsService } from './contacts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Contact])],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
